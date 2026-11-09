
import React, { useEffect, useMemo, useState } from "react";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonToast,
} from "@ionic/react";

import {
  arrowBackOutline,
  chevronForwardOutline,
  timeOutline,
  schoolOutline,
  closeOutline,
  documentTextOutline,
  calendarOutline,
  businessOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from "ionicons/icons";

import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  DocumentData,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../../Firebase/config";
import StudentBottomNav from "../../components/StudentBottomNav";
import "./ApplicationHistory.css";

interface SubmittedRequirement {
  name: string;
  url: string;
  mimeType?: string;
}

interface ApplicationItem {
  id: string;
  studentId?: string;

  scholarshipId?: string;
  scholarshipName?: string;
  scholarshipTitle?: string;
  scholarshipAmount?: string;

  organizationId?: string;
  organizationName?: string;
  organizationLogo?: string;
  providerLogo?: string;
  logoUrl?: string;
  scholarshipLogo?: string;

  status?: string;
  remarks?: string;
  rejectionReason?: string;

  submittedAt?: Timestamp | Date | string | number | null;
  createdAt?: Timestamp | Date | string | number | null;

  requirements?: unknown;

  deadline?: string;
  course?: string;
  school?: string;
  yearLevel?: string;
}

type HistoryFilter = "All" | "Pending" | "Approved" | "Rejected";

const FILTERS: HistoryFilter[] = [
  "All",
  "Pending",
  "Approved",
  "Rejected",
];

const getString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
};

const getApplicationDate = (
  application: ApplicationItem
): Date | null => {
  const value = application.submittedAt ?? application.createdAt;

  if (!value) return null;

  try {
    let date: Date;

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof value.toDate === "function"
    ) {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      date = new Date(value);
    } else {
      return null;
    }

    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const formatDate = (application: ApplicationItem): string => {
  const date = getApplicationDate(application);

  if (!date) return "Date unavailable";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getStatusLabel = (status?: string): string => {
  const normalized = getString(status, "Pending")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
};

const getStatusCategory = (
  status?: string
): "approved" | "rejected" | "pending" => {
  const normalized = getString(status, "pending")
    .toLowerCase()
    .replace(/[_\s-]/g, "");

  if (
    normalized.includes("approved") ||
    normalized.includes("accepted")
  ) {
    return "approved";
  }

  if (
    normalized.includes("rejected") ||
    normalized.includes("denied")
  ) {
    return "rejected";
  }

  return "pending";
};

const getSubmittedRequirements = (
  value: unknown
): SubmittedRequirement[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];

    const record = item as Record<string, unknown>;

    const url =
      record.url ??
      record.downloadURL ??
      record.downloadUrl;

    if (typeof url !== "string") return [];

    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:"
      ) {
        return [];
      }
    } catch {
      return [];
    }

    return [
      {
        name:
          typeof record.name === "string" &&
          record.name.trim()
            ? record.name.trim()
            : `Requirement ${index + 1}`,
        url,
        mimeType: getString(record.mimeType) || undefined,
      },
    ];
  });
};

const getApplicationLogo = (
  application: ApplicationItem
): string => {
  return (
    getString(application.organizationLogo) ||
    getString(application.providerLogo) ||
    getString(application.scholarshipLogo) ||
    getString(application.logoUrl)
  );
};

const getScholarshipName = (
  application: ApplicationItem
): string => {
  return (
    getString(application.scholarshipTitle) ||
    getString(application.scholarshipName) ||
    "Scholarship Application"
  );
};

const ApplicationHistory: React.FC = () => {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedFilter, setSelectedFilter] =
    useState<HistoryFilter>("All");

  const [selectedApplication, setSelectedApplication] =
    useState<ApplicationItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const [showDetails, setShowDetails] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // REAL-TIME FIRESTORE APPLICATION HISTORY
  useEffect(() => {
    let active = true;
    let unsubscribeApplications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeApplications?.();
      unsubscribeApplications = undefined;

      if (!active) return;

      if (!user) {
        setApplications([]);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      const applicationsQuery = query(
        collection(db, "applications"),
        where("studentId", "==", user.uid)
      );

      unsubscribeApplications = onSnapshot(
        applicationsQuery,
        (snapshot) => {
          if (!active) return;

          const items: ApplicationItem[] = snapshot.docs.map(
            (applicationDoc) => {
              const data =
                applicationDoc.data() as DocumentData;

              return {
                id: applicationDoc.id,
                studentId: getString(data.studentId),

                scholarshipId: getString(data.scholarshipId),
                scholarshipName: getString(data.scholarshipName),
                scholarshipTitle: getString(data.scholarshipTitle),
                scholarshipAmount: getString(data.scholarshipAmount),

                organizationId: getString(data.organizationId),
                organizationName: getString(data.organizationName),
                organizationLogo: getString(data.organizationLogo),
                providerLogo: getString(data.providerLogo),
                logoUrl: getString(data.logoUrl),
                scholarshipLogo: getString(data.scholarshipLogo),

                status: getString(data.status, "Pending"),
                remarks: getString(data.remarks),
                rejectionReason: getString(data.rejectionReason),

                submittedAt: data.submittedAt ?? null,
                createdAt: data.createdAt ?? null,

                requirements: data.requirements,

                deadline: getString(data.deadline),
                course: getString(data.course),
                school: getString(data.school),
                yearLevel: getString(data.yearLevel),
              };
            }
          );

          // Sort newest application first
          items.sort((a, b) => {
            const dateA = getApplicationDate(a)?.getTime() ?? 0;
            const dateB = getApplicationDate(b)?.getTime() ?? 0;

            return dateB - dateA;
          });

          setApplications(items);
          setLoading(false);
          setError("");
        },
        (snapshotError) => {
          if (!active) return;

          console.error(
            "Error loading application history:",
            snapshotError.code,
            snapshotError.message
          );

          setError(
            snapshotError.code === "permission-denied"
              ? "You do not have permission to view your application history. Please check your Firestore Rules."
              : "Unable to load your application history. Please try again."
          );

          setLoading(false);
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeApplications?.();
    };
  }, [navigate, retryCount]);

  // FILTER APPLICATIONS
  const filteredApplications = useMemo(() => {
    if (selectedFilter === "All") {
      return applications;
    }

    return applications.filter(
      (application) =>
        getStatusCategory(application.status) ===
        selectedFilter.toLowerCase()
    );
  }, [applications, selectedFilter]);

  // FILTER COUNTS
  const filterCounts = useMemo(() => {
    return {
      All: applications.length,
      Pending: applications.filter(
        (item) => getStatusCategory(item.status) === "pending"
      ).length,
      Approved: applications.filter(
        (item) => getStatusCategory(item.status) === "approved"
      ).length,
      Rejected: applications.filter(
        (item) => getStatusCategory(item.status) === "rejected"
      ).length,
    };
  }, [applications]);

  // OPEN APPLICATION DETAILS
  const handleViewDetails = (application: ApplicationItem) => {
    setSelectedApplication(application);
    setShowDetails(true);
  };

  // CLOSE DETAILS
  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedApplication(null);
  };

  // RETRY FIRESTORE LISTENER
  const handleRetry = () => {
    setError("");
    setLoading(true);
    setRetryCount((previous) => previous + 1);
  };

  const requirements = selectedApplication
    ? getSubmittedRequirements(selectedApplication.requirements)
    : [];

  return (
    <IonPage className="history-page">
      {/* GREEN HEADER */}
      <header className="history-top-header">
        <button
          type="button"
          className="history-back-button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <IonIcon icon={arrowBackOutline} />
        </button>

        <h1>Application History</h1>

        <div className="history-header-spacer" />
      </header>

      <IonContent className="history-content">
        <main className="history-container">

          {/* FILTER TABS */}
          <section
            className="history-filter-section"
            aria-label="Filter applications by status"
          >
            <div className="history-filter-list">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={`history-filter-chip ${
                    selectedFilter === filter ? "active" : ""
                  }`}
                  onClick={() => setSelectedFilter(filter)}
                  aria-pressed={selectedFilter === filter}
                >
                  {filter}
                </button>
              ))}
            </div>
          </section>

          {/* APPLICATION COUNT */}
          {!loading && !error && applications.length > 0 && (
            <div className="history-results-heading">
              <span>
                {filteredApplications.length}{" "}
                {filteredApplications.length === 1
                  ? "application"
                  : "applications"}
              </span>

              <span className="history-results-total">
                {selectedFilter === "All"
                  ? "All applications"
                  : `${selectedFilter} applications`}
              </span>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="history-message">
              <IonSpinner name="crescent" />
              <p>Loading applications...</p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="history-empty-state history-error-state">
              <div className="history-empty-icon">
                <IonIcon icon={alertCircleOutline} />
              </div>

              <h2>Something went wrong</h2>
              <p>{error}</p>

              <button
                type="button"
                className="history-retry-button"
                onClick={handleRetry}
              >
                Try Again
              </button>
            </div>
          )}

          {/* NO APPLICATIONS */}
          {!loading && !error && applications.length === 0 && (
            <div className="history-empty-state">
              <div className="history-empty-icon">
                <IonIcon icon={timeOutline} />
              </div>

              <h2>No Applications Yet</h2>

              <p>
                You haven't submitted any scholarship applications
                yet. Once you apply, your application history will
                appear here.
              </p>

              <button
                type="button"
                className="history-browse-button"
                onClick={() => navigate("/scholarships")}
              >
                Browse Scholarships
              </button>
            </div>
          )}

          {/* EMPTY FILTER RESULT */}
          {!loading &&
            !error &&
            applications.length > 0 &&
            filteredApplications.length === 0 && (
              <div className="history-empty-state history-filter-empty">
                <div className="history-empty-icon">
                  <IonIcon icon={schoolOutline} />
                </div>

                <h2>No {selectedFilter} Applications</h2>

                <p>
                  You don't have any applications with this status.
                </p>

                <button
                  type="button"
                  className="history-browse-button"
                  onClick={() => setSelectedFilter("All")}
                >
                  View All Applications
                </button>
              </div>
            )}

          {/* APPLICATION CARDS */}
          {!loading &&
            !error &&
            filteredApplications.length > 0 && (
              <section className="history-list-section">
                <div className="history-list">
                  {filteredApplications.map((application) => {
                    const statusClass = getStatusCategory(
                      application.status
                    );

                    const logo = getApplicationLogo(application);

                    return (
                      <button
                        type="button"
                        className="history-card"
                        key={application.id}
                        onClick={() =>
                          handleViewDetails(application)
                        }
                      >
                        {/* ORGANIZATION LOGO */}
                        <div className="history-card-logo">
                          {logo ? (
                            <img
                              src={logo}
                              alt={`${application.organizationName || "Organization"} logo`}
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <IonIcon icon={schoolOutline} />
                          )}
                        </div>

                        {/* APPLICATION INFORMATION */}
                        <div className="history-card-content">
                          <h2>
                            {getScholarshipName(application)}
                          </h2>

                          {application.organizationName && (
                            <p className="history-card-organization">
                              {application.organizationName}
                            </p>
                          )}

                          <p className="history-card-date">
                            Applied: {formatDate(application)}
                          </p>
                        </div>

                        {/* STATUS AND ARROW */}
                        <div className="history-card-right">
                          <span
                            className={`history-status-badge status-${statusClass}`}
                          >
                            {getStatusLabel(application.status)}
                          </span>

                          <IonIcon
                            className="history-card-arrow"
                            icon={chevronForwardOutline}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

          <div className="history-bottom-space" />
        </main>
      </IonContent>

      {/* APPLICATION DETAILS MODAL */}
      <IonModal
        isOpen={showDetails}
        onDidDismiss={handleCloseDetails}
        className="history-details-modal"
      >
        {selectedApplication && (
          <>
            <IonHeader>
              <IonToolbar className="history-modal-toolbar">
                <IonTitle>Application Details</IonTitle>

                <IonButton
                  slot="end"
                  fill="clear"
                  aria-label="Close details"
                  onClick={handleCloseDetails}
                >
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonToolbar>
            </IonHeader>

            <IonContent className="history-modal-content">
              <div className="history-modal-body">

                <div className="history-modal-logo">
                  {getApplicationLogo(selectedApplication) ? (
                    <img
                      src={getApplicationLogo(selectedApplication)}
                      alt="Organization logo"
                    />
                  ) : (
                    <IonIcon icon={schoolOutline} />
                  )}
                </div>

                <span
                  className={`history-status-badge status-${getStatusCategory(
                    selectedApplication.status
                  )}`}
                >
                  {getStatusLabel(selectedApplication.status)}
                </span>

                <h2>
                  {getScholarshipName(selectedApplication)}
                </h2>

                {selectedApplication.organizationName && (
                  <p className="history-modal-provider">
                    {selectedApplication.organizationName}
                  </p>
                )}

                <div className="history-modal-information">
                  <div>
                    <IonIcon icon={calendarOutline} />
                    <span>
                      <small>Application date</small>
                      <strong>
                        {formatDate(selectedApplication)}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <IonIcon icon={businessOutline} />
                    <span>
                      <small>Scholarship provider</small>
                      <strong>
                        {selectedApplication.organizationName ||
                          "Not specified"}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <IonIcon icon={schoolOutline} />
                    <span>
                      <small>Financial assistance</small>
                      <strong>
                        {selectedApplication.scholarshipAmount ||
                          "Not specified"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* REVIEW REMARKS */}
                {(selectedApplication.remarks ||
                  selectedApplication.rejectionReason) && (
                  <section className="history-modal-section">
                    <h3>Review Remarks</h3>

                    <p className="history-modal-remarks">
                      {selectedApplication.remarks ||
                        selectedApplication.rejectionReason}
                    </p>
                  </section>
                )}

                {/* SUBMITTED DOCUMENTS */}
                <section className="history-modal-section">
                  <h3>Submitted Documents</h3>

                  {requirements.length > 0 ? (
                    <div className="history-document-list">
                      {requirements.map((requirement, index) => (
                        <a
                          key={`${requirement.url}-${index}`}
                          href={requirement.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="history-document-item"
                        >
                          <IonIcon icon={documentTextOutline} />

                          <span>{requirement.name}</span>

                          <IonIcon
                            className="history-document-arrow"
                            icon={chevronForwardOutline}
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="history-no-documents">
                      No submitted documents found.
                    </p>
                  )}
                </section>

                <IonButton
                  expand="block"
                  className="history-modal-close-button"
                  onClick={handleCloseDetails}
                >
                  Close Details
                </IonButton>
              </div>
            </IonContent>
          </>
        )}
      </IonModal>

      {/* TOAST */}
      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={3500}
        position="top"
        onDidDismiss={() => setShowToast(false)}
      />

      <StudentBottomNav />
    </IonPage>
  );
};

export default ApplicationHistory;
