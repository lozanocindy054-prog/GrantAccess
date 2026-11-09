import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast,
} from "@ionic/react";
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  locationOutline,
  schoolOutline,
  cloudUploadOutline,
} from "ionicons/icons";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../Firebase/config";
import StudentHeader from "../../components/StudentHeader";
import StudentBottomNav from "../../components/StudentBottomNav";
import StudentDocumentAccess from "../../components/StudentDocumentAccess";
import "./StudentApplication.css";

interface DownloadableFile {
  name: string;
  url: string;
  category?: string;
  description?: string;
  driveFileId?: string;
  previewUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
  organizationName?: string;
}

interface Scholarship {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  organizationName: string;
  amount: string;
  deadline: string;
  applicationStart: string;
  eligibility: string;
  applicationStatus: "open" | "closed" | "upcoming";
  requiredDocuments: string[];
  attachments: DownloadableFile[];
  benefits: string;
  applicationMethod: "step-by-step" | "direct" | "external";
  externalApplicationUrl: string;
  requireEligibilityAssessment: boolean;
  requireDocumentSubmission: boolean;
  allowOptionalDocuments: boolean;
}

interface StudentProfile {
  fullName: string;
  email: string;
  studentId: string;
  school: string;
  course: string;
  yearLevel: string;
  phone: string;
}

interface LocationConsentData {
  latitude: number;
  longitude: number;
}

const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "verlmdcg";
const CLOUDINARY_DOCUMENT_PRESET =
  import.meta.env.VITE_CLOUDINARY_DOCUMENT_UPLOAD_PRESET ||
  "grantaccess_documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUIRED_DOCUMENTS = 10;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const getString = (value: unknown, fallback = ""): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;

const getRequiredDocuments = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
};

const getAttachments = (value: unknown): DownloadableFile[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.name !== "string" ||
      typeof record.url !== "string"
    ) {
      return [];
    }

    return [{
      name: record.name,
      url: record.url,
      category:
        typeof record.category === "string" ? record.category : undefined,
      description:
        typeof record.description === "string"
          ? record.description
          : undefined,
      driveFileId:
        typeof record.driveFileId === "string"
          ? record.driveFileId
          : undefined,
      previewUrl:
        typeof record.previewUrl === "string"
          ? record.previewUrl
          : undefined,
      downloadUrl:
        typeof record.downloadUrl === "string"
          ? record.downloadUrl
          : undefined,
      mimeType:
        typeof record.mimeType === "string" ? record.mimeType : undefined,
      organizationName:
        typeof record.organizationName === "string"
          ? record.organizationName
          : undefined,
    }];
  });
};

const getApproximateLocation = (): Promise<LocationConsentData> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location services are not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: Math.round(coords.latitude * 100) / 100,
          longitude: Math.round(coords.longitude * 100) / 100,
        });
      },
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied. Turn off location sharing or allow location access to continue."
              : "Unable to get your location. Please try again or turn off location sharing."
          )
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });

const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_DOCUMENT_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );
  const result = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "A document could not be uploaded.");
  }

  return {
    name: file.name,
    url: result.secure_url,
    publicId: result.public_id || "",
    size: file.size,
    mimeType: file.type,
    status: "Submitted",
  };
};

const StudentApplication: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stepProgressRef = useRef<HTMLDivElement>(null);
  const routeState = location.state as { scholarshipId?: string } | null;
  const scholarshipId =
    routeState?.scholarshipId ||
    new URLSearchParams(location.search).get("scholarshipId") ||
    "";

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [optionalFiles, setOptionalFiles] = useState<File[]>([]);
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [shareLocation, setShareLocation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", color: "danger" });

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserId(user.uid);
      if (!scholarshipId) {
        setToast({
          visible: true,
          message: "Choose a scholarship before starting an application.",
          color: "warning",
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      setScholarship(null);
      setFiles({});
      setOptionalFiles([]);
      setEligibilityConfirmed(false);
      setCurrentStep(0);
      try {
        const [scholarshipSnapshot, profileSnapshot] = await Promise.all([
          getDoc(doc(db, "scholarships", scholarshipId)),
          getDoc(doc(db, "students", user.uid)),
        ]);

        if (!scholarshipSnapshot.exists()) {
          throw new Error("This scholarship could not be found.");
        }

        const data = scholarshipSnapshot.data();
        if (String(data.status ?? "").toLowerCase() !== "published") {
          throw new Error("This scholarship is not currently published.");
        }
        if (!profileSnapshot.exists()) {
          throw new Error("Your student profile could not be found.");
        }
        const requiredDocuments = getRequiredDocuments(
          data.requiredDocuments
        );
        if (requiredDocuments.length > MAX_REQUIRED_DOCUMENTS) {
          throw new Error(
            "This scholarship has more than 10 required documents. Contact the organization to update its listing."
          );
        }
        const profileData = profileSnapshot.data();

        if (active) {
          setCurrentStep(0);
          setFiles({});
          setOptionalFiles([]);
          setEligibilityConfirmed(false);
          setShareLocation(false);
          setScholarship({
            id: scholarshipSnapshot.id,
            title: getString(data.title ?? data.name, "Scholarship"),
            description: getString(data.description),
            organizationId: getString(
              data.organizationId ?? data.providerId
            ),
            organizationName: getString(
              data.organizationName ?? data.providerName ?? data.provider,
              "Participating organization"
            ),
            amount: getString(data.amount, "Not specified"),
            deadline: getString(data.deadline, "Not specified"),
            applicationStart: getString(data.applicationStart),
            eligibility: getString(data.eligibility),
            applicationStatus: ["open", "closed", "upcoming"].includes(
              String(data.applicationStatus ?? "open").toLowerCase()
            )
              ? String(data.applicationStatus ?? "open").toLowerCase() as Scholarship["applicationStatus"]
              : "open",
            requiredDocuments:
              data.requireDocumentSubmission === false ? [] : requiredDocuments,
            attachments: getAttachments(data.attachments),
            benefits: getString(data.benefits),
            applicationMethod: ["step-by-step", "direct", "external"].includes(
              String(data.applicationMethod ?? "step-by-step")
            )
              ? String(data.applicationMethod ?? "step-by-step") as Scholarship["applicationMethod"]
              : "step-by-step",
            externalApplicationUrl: getString(data.externalApplicationUrl),
            requireEligibilityAssessment:
              data.requireEligibilityAssessment === true,
            requireDocumentSubmission: data.requireDocumentSubmission !== false,
            allowOptionalDocuments: data.allowOptionalDocuments === true,
          });
          setProfile({
            fullName: getString(profileData.fullName ?? profileData.name),
            email: getString(profileData.email ?? user.email),
            studentId: getString(
              profileData.studentId ?? profileData.studentNumber
            ),
            school: getString(profileData.school ?? profileData.schoolName),
            course: getString(profileData.course ?? profileData.program),
            yearLevel: getString(profileData.yearLevel),
            phone: getString(
              profileData.phone ?? profileData.contactNumber
            ),
          });
        }
      } catch (error) {
        console.error("Unable to load application details:", error);
        if (active) {
          setToast({
            visible: true,
            message:
              error instanceof Error
                ? error.message
                : "Unable to load this scholarship. Please try again.",
            color: "danger",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, scholarshipId]);

  useEffect(() => {
    stepProgressRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentStep]);

  const missingRequirements = useMemo(
    () => scholarship?.requiredDocuments.filter((name) => !files[name]) ?? [],
    [files, scholarship]
  );
  const isDirectApplication = scholarship?.applicationMethod === "direct";
  const totalSteps = isDirectApplication
    ? 3
    : (scholarship?.requiredDocuments.length ?? 0) + 2;
  const isReviewStep = currentStep === totalSteps - 1;
  const currentRequirement =
    scholarship && currentStep > 0 && !isReviewStep
      && !isDirectApplication
      ? scholarship.requiredDocuments[currentStep - 1]
      : undefined;
  const currentRequirements =
    isDirectApplication && currentStep === 1
      ? scholarship?.requiredDocuments ?? []
      : currentRequirement
        ? [currentRequirement]
        : [];

  const selectFile = (name: string, file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setToast({
        visible: true,
        message: "Upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file.",
        color: "warning",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setToast({
        visible: true,
        message: `${file.name} exceeds the 10 MB limit.`,
        color: "warning",
      });
      return;
    }

    setFiles((previous) => ({ ...previous, [name]: file }));
  };

  const selectOptionalFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const accepted = Array.from(selectedFiles).filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setToast({
          visible: true,
          message: `${file.name}: upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file.`,
          color: "warning",
        });
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        setToast({
          visible: true,
          message: `${file.name} exceeds the 10 MB limit.`,
          color: "warning",
        });
        return false;
      }
      return true;
    });
    setOptionalFiles((current) => {
      const combined = [...current, ...accepted].filter(
        (file, index, list) =>
          list.findIndex(
            (candidate) =>
              candidate.name === file.name && candidate.size === file.size
          ) === index
      );
      if (combined.length > MAX_REQUIRED_DOCUMENTS) {
        setToast({
          visible: true,
          message: "You can attach up to 10 optional supporting documents.",
          color: "warning",
        });
      }
      return combined.slice(0, MAX_REQUIRED_DOCUMENTS);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !profile || !scholarship) return;

    if (scholarship.applicationStatus !== "open") {
      setToast({
        visible: true,
        message:
          scholarship.applicationStatus === "upcoming"
            ? "Applications for this scholarship have not opened yet."
            : "Applications for this scholarship are closed.",
        color: "warning",
      });
      return;
    }

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (
      (scholarship.applicationStart &&
        scholarship.applicationStart > todayString) ||
      (scholarship.deadline &&
        /^\d{4}-\d{2}-\d{2}$/.test(scholarship.deadline) &&
        scholarship.deadline < todayString)
    ) {
      setToast({
        visible: true,
        message:
          scholarship.applicationStart > todayString
            ? "Applications have not opened yet."
            : "The application deadline has passed.",
        color: "warning",
      });
      return;
    }

    if (missingRequirements.length > 0) {
      setToast({
        visible: true,
        message: "Upload every required document before submitting.",
        color: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const duplicateQuery = query(
        collection(db, "applications"),
        where("studentId", "==", userId)
      );
      const existingApplications = await getDocs(duplicateQuery);

      if (
        existingApplications.docs.some(
          (application) => application.data().scholarshipId === scholarship.id
        )
      ) {
        setToast({
          visible: true,
          message: "You have already applied for this scholarship.",
          color: "warning",
        });
        return;
      }

      const approximateLocation = shareLocation
        ? await getApproximateLocation()
        : null;

      const submittedRequirements = await Promise.all(
        scholarship.requiredDocuments.map(async (name) => {
          const file = files[name];
          return uploadDocument(file);
        })
      );
      const submittedOptionalFiles = await Promise.all(
        optionalFiles.map(async (file) => ({
          ...(await uploadDocument(file)),
          requirementType: "Optional",
        }))
      );

      await addDoc(collection(db, "applications"), {
        studentId: userId,
        studentName: profile.fullName,
        studentEmail: profile.email,
        studentNumber: profile.studentId,
        contactNumber: profile.phone,
        school: profile.school,
        course: profile.course,
        yearLevel: profile.yearLevel,
        scholarshipId: scholarship.id,
        scholarshipTitle: scholarship.title,
        scholarshipAmount: scholarship.amount,
        organizationId: scholarship.organizationId,
        organizationName: scholarship.organizationName,
        requirements: [...submittedRequirements, ...submittedOptionalFiles],
        eligibilityConfirmed:
          scholarship.requireEligibilityAssessment
            ? eligibilityConfirmed
            : null,
        status: "Pending",
        remarks: "",
        locationConsent: shareLocation,
        approximateLocation,
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      navigate("/application-history", {
        replace: true,
        state: { applicationSubmitted: true },
      });
    } catch (error) {
      console.error("Unable to submit scholarship application:", error);
      setToast({
        visible: true,
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit your application. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonPage className="student-application-page">
      <StudentHeader />
      <IonContent className="student-application-content">
        <main className="student-application-layout">
          <button
            type="button"
            className="student-application-back"
            onClick={() => navigate("/scholarships")}
          >
            <IonIcon icon={arrowBackOutline} />
            Back to scholarships
          </button>

          {loading ? (
            <div className="student-application-loading">
              <IonSpinner name="crescent" />
              <span>Preparing your application...</span>
            </div>
          ) : scholarship?.applicationMethod === "external" ? (
            <section className="student-application-card student-application-external">
              <header className="student-application-heading">
                <span className="student-application-eyebrow">
                  EXTERNAL APPLICATION
                </span>
                <h1>{scholarship.title}</h1>
                <p>
                  This organization accepts applications on its own secure
                  application website.
                </p>
              </header>
              <div className="student-application-section">
                <p>
                  Review the organization’s eligibility and requirements,
                  then continue to its application portal.
                </p>
                {scholarship.eligibility && (
                  <p><strong>Eligibility:</strong> {scholarship.eligibility}</p>
                )}
                {scholarship.requiredDocuments.length > 0 && (
                  <ul>
                    {scholarship.requiredDocuments.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                )}
                <a
                  className="student-application-submit"
                  href={scholarship.externalApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue to organization application
                </a>
              </div>
            </section>
          ) : scholarship ? (
            <form
              className="student-application-card"
              onSubmit={handleSubmit}
            >
              <header className="student-application-heading">
                <span className="student-application-eyebrow">
                  SCHOLARSHIP APPLICATION
                </span>
                <h1>{scholarship.title}</h1>
                <p>
                  Offered by <strong>{scholarship.organizationName}</strong>
                </p>
                <div className="student-application-summary">
                  <span>
                    <IonIcon icon={schoolOutline} />
                    {scholarship.amount}
                  </span>
                  <span>
                    Application deadline: {scholarship.deadline}
                  </span>
                </div>
              </header>

              <div className="application-step-progress" ref={stepProgressRef}>
                <div className="application-step-caption">
                  <strong>
                    Step {currentStep + 1} of {totalSteps}
                  </strong>
                  <span>
                    {currentStep === 0
                      ? "Review opportunity"
                      : isReviewStep
                        ? "Final review"
                        : isDirectApplication
                          ? "Upload documents"
                          : `Document ${currentStep} of ${scholarship.requiredDocuments.length}`}
                  </span>
                </div>
                <div className="application-step-track">
                  <span
                    style={{
                      width: `${((currentStep + 1) / totalSteps) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {currentStep === 0 && (
                <section className="student-application-section">
                  <h2>About this scholarship</h2>
                  <p>
                    {scholarship.description || "No description provided."}
                  </p>
                  {scholarship.benefits && (
                    <p>
                      <strong>Benefits:</strong> {scholarship.benefits}
                    </p>
                  )}
                  {scholarship.eligibility && (
                    <p>
                      <strong>Eligibility:</strong> {scholarship.eligibility}
                    </p>
                  )}

                  {scholarship.attachments.length > 0 && (
                    <div className="application-download-section">
                      <h3>Download forms before you continue</h3>
                      <div className="student-application-downloads">
                        {scholarship.attachments.map((file, index) => (
                          <StudentDocumentAccess
                            key={`${file.url}-${index}`}
                            document={file}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {currentRequirements.length > 0 && (
                <section className="student-application-section application-current-requirement">
                  <span className="application-requirement-step">
                    {isDirectApplication
                      ? "Required documents"
                      : `Required document ${currentStep}`}
                  </span>
                  <h2>
                    {isDirectApplication
                      ? "Upload your required documents"
                      : currentRequirement}
                  </h2>
                  <p>
                    Upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file up to 10
                    MB. Photos are accepted for requirements such as a student
                    ID.
                  </p>
                  {currentRequirements.map((requirement) => (
                    <div
                      className="application-requirement-upload"
                      key={requirement}
                    >
                      <label className="student-application-upload">
                        <span className="student-application-requirement-name">
                          <IonIcon icon={documentTextOutline} />
                          {requirement}
                          <strong>Required</strong>
                        </span>
                        <span className="student-application-file-input">
                          <IonIcon icon={cloudUploadOutline} />
                          {files[requirement]?.name || "Choose a document"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={(event) => {
                            selectFile(requirement, event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {files[requirement] && (
                        <p className="application-upload-confirmed">
                          <IonIcon icon={checkmarkCircleOutline} />
                          {files[requirement].name} added
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {isReviewStep && (
                <>
                  <section className="student-application-section">
                    <h2>Review your application</h2>
                    <p>
                      Check every document before submitting your application.
                    </p>
                    <div className="application-review-list">
                      {scholarship.requiredDocuments.length > 0 ? (
                        scholarship.requiredDocuments.map((name) => (
                          <div key={name}>
                            <IonIcon
                              icon={
                                files[name]
                                  ? checkmarkCircleOutline
                                  : documentTextOutline
                              }
                            />
                            <span>{name}</span>
                            <strong>
                              {files[name]?.name || "Missing document"}
                            </strong>
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentStep(
                                  isDirectApplication
                                    ? 1
                                    : scholarship.requiredDocuments.indexOf(name) + 1
                                )
                              }
                            >
                              Change
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="student-application-no-requirements">
                          No document uploads are required for this
                          scholarship.
                        </p>
                      )}
                    </div>
                  </section>

                  {scholarship.allowOptionalDocuments && (
                    <section className="student-application-section">
                      <h2>Optional supporting documents</h2>
                      <p>
                        You may include up to 10 additional files. Each file
                        must be 10 MB or smaller.
                      </p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => {
                          selectOptionalFiles(event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                      {optionalFiles.map((file, index) => (
                        <div className="application-optional-file" key={`${file.name}-${index}`}>
                          <span>{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setOptionalFiles((current) =>
                                current.filter((_, fileIndex) => fileIndex !== index)
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                  )}

                  {scholarship.requireEligibilityAssessment && (
                    <section className="student-application-location">
                      <label>
                        <input
                          type="checkbox"
                          checked={eligibilityConfirmed}
                          onChange={(event) =>
                            setEligibilityConfirmed(event.target.checked)
                          }
                        />
                        <span>
                          <strong>I confirm that I meet the eligibility requirements above.</strong>
                          <small>
                            Your confirmation will be included with your
                            application for the organization to review.
                          </small>
                        </span>
                      </label>
                    </section>
                  )}

                  <section className="student-application-location">
                    <label>
                      <input
                        type="checkbox"
                        checked={shareLocation}
                        onChange={(event) =>
                          setShareLocation(event.target.checked)
                        }
                      />
                      <span>
                        <strong>
                          <IonIcon icon={locationOutline} />
                          Share my approximate location with this organization
                        </strong>
                        <small>
                          Optional. Your location is rounded to about 1 km and
                          shared with this scholarship provider after you
                          apply. If the provider opens the map, OpenStreetMap
                          also receives those rounded coordinates to display
                          them. Other students cannot see your location.
                        </small>
                      </span>
                    </label>
                  </section>
                </>
              )}

              <footer className="student-application-actions">
                <button
                  type="button"
                  className="student-application-cancel"
                  onClick={() =>
                    currentStep > 0
                      ? setCurrentStep((step) => step - 1)
                      : navigate("/scholarships")
                  }
                  disabled={submitting}
                >
                  {currentStep > 0 ? "Back" : "Cancel"}
                </button>
                {isReviewStep ? (
                  <button
                    type="submit"
                    className="student-application-submit"
                    disabled={
                      submitting ||
                      scholarship.applicationStatus === "closed" ||
                      scholarship.applicationStatus === "upcoming" ||
                      missingRequirements.length > 0 ||
                      (scholarship.requireEligibilityAssessment &&
                        !eligibilityConfirmed)
                    }
                  >
                    {submitting ? (
                      <>
                        <IonSpinner name="crescent" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <IonIcon icon={checkmarkCircleOutline} />
                        Submit application
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="student-application-submit"
                    disabled={
                      (!!currentRequirement && !files[currentRequirement]) ||
                      (isDirectApplication &&
                        currentStep === 1 &&
                        missingRequirements.length > 0)
                    }
                    onClick={() =>
                      setCurrentStep((step) => Math.min(step + 1, totalSteps - 1))
                    }
                  >
                    {currentStep === 0
                      ? isDirectApplication &&
                        scholarship.requiredDocuments.length > 0
                        ? "Continue to uploads"
                        : "Continue"
                      : currentRequirement ||
                          (isDirectApplication &&
                            currentStep === 1 &&
                            missingRequirements.length > 0)
                        ? "Save & continue"
                        : "Continue to review"}
                  </button>
                )}
              </footer>
            </form>
          ) : (
            <section className="student-application-card student-application-error">
              <h1>Application unavailable</h1>
              <p>
                Select an available scholarship and try applying again.
              </p>
              <button
                type="button"
                className="student-application-submit"
                onClick={() => navigate("/scholarships", { replace: true })}
              >
                Browse scholarships
              </button>
            </section>
          )}
        </main>
      </IonContent>
      <StudentBottomNav />
      <IonToast
        isOpen={toast.visible}
        message={toast.message}
        color={toast.color}
        duration={4000}
        position="top"
        onDidDismiss={() =>
          setToast((previous) => ({ ...previous, visible: false }))
        }
      />
    </IonPage>
  );
};

export default StudentApplication;
