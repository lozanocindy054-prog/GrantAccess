import { useAppBack } from '../../hooks/useAppBack';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonButton,
  IonSpinner,
  IonModal,
  IonToast,
} from "@ionic/react";

import {
  schoolOutline,
  searchOutline,
  calendarOutline,
  locationOutline,
  closeOutline,
  cashOutline,
  documentTextOutline,
  arrowBackOutline,
  bookmarkOutline,
  bookmark,
  shareSocialOutline,
  businessOutline,
} from "ionicons/icons";

import { useLocation, useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  where,
  DocumentData,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../../Firebase/config";
import StudentBottomNav from "../../components/StudentBottomNav";
import StudentDocumentAccess from "../../components/StudentDocumentAccess";
import "./Scholarships.css";

interface ScholarshipAttachment {
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
  name: string;
  provider: string;
  amount: string;
  type: string;
  deadline: string;
  location: string;
  description: string;
  eligibility: string;
  requiredDocuments: string[];
  attachments: ScholarshipAttachment[];
  applicationStatus: "open" | "closed" | "upcoming";
  logo: string;
  coverImage: string;
  isLocal: boolean;
}

const CATEGORY_FILTERS = [
  "All",
  "Academic",
  "Financial Need",
  "Local",
];

const safeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
};

const getScholarshipLogo = (data: DocumentData): string => {
  return safeString(
    data.organizationLogo ??
      data.providerLogo ??
      data.logoUrl ??
      data.logo ??
      data.photoURL,
    ""
  );
};

const getScholarshipCover = (data: DocumentData): string => {
  return safeString(
    data.coverImage ??
      data.bannerImage ??
      data.bannerUrl ??
      data.featuredImage ??
      data.imageUrl ??
      data.scholarshipImage,
    ""
  );
};

const getApplicationStatus = (
  value: unknown
): Scholarship["applicationStatus"] => {
  const status = safeString(value, "open").toLowerCase();

  if (status === "closed" || status === "upcoming" || status === "open") {
    return status;
  }

  return "open";
};

const getRequiredDocuments = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item: unknown): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getAttachments = (value: unknown): ScholarshipAttachment[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];

    const attachment = item as DocumentData;

    if (
      typeof attachment.name !== "string" ||
      typeof attachment.url !== "string"
    ) {
      return [];
    }

    return [
      {
        name: attachment.name,
        url: attachment.url,
        category: safeString(attachment.category) || undefined,
        description: safeString(attachment.description) || undefined,
        driveFileId: safeString(attachment.driveFileId) || undefined,
        previewUrl: safeString(attachment.previewUrl) || undefined,
        downloadUrl: safeString(attachment.downloadUrl) || undefined,
        mimeType: safeString(attachment.mimeType) || undefined,
        organizationName:
          safeString(attachment.organizationName) || undefined,
      },
    ];
  });
};

const Scholarships: React.FC = () => {
  const goBack = useAppBack();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [selectedScholarship, setSelectedScholarship] =
    useState<Scholarship | null>(null);

  const [savedScholarships, setSavedScholarships] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingScholarshipId, setSavingScholarshipId] = useState<
    string | null
  >(null);

  const [showDetails, setShowDetails] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchText(params.get("search") ?? "");
  }, [location.search]);

  // Real-time scholarship and saved scholarship listeners.
  useEffect(() => {
    let active = true;

    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribeSaved: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeScholarships?.();
      unsubscribeSaved?.();

      unsubscribeScholarships = undefined;
      unsubscribeSaved = undefined;

      if (!active) return;

      if (!user) {
        setCurrentUserId(null);
        setScholarships([]);
        setSavedScholarships([]);
        setLoading(false);
        setToastMessage("Please log in to view available scholarships.");
        setShowToast(true);
        return;
      }

      setCurrentUserId(user.uid);
      setLoading(true);

      const scholarshipsQuery = query(
        collection(db, "scholarships"),
        where("status", "==", "published")
      );

      unsubscribeScholarships = onSnapshot(
        scholarshipsQuery,
        (snapshot) => {
          if (!active) return;

          const list: Scholarship[] = snapshot.docs.map((item) => {
            const data = item.data() as DocumentData;

            return {
              id: item.id,
              name: safeString(
                data.name ?? data.title,
                "Untitled Scholarship"
              ),
              provider: safeString(
                data.provider ??
                  data.organizationName ??
                  data.organization ??
                  data.providerName,
                "Not specified"
              ),
              amount: safeString(data.amount, "Not specified"),
              type: safeString(data.type ?? data.category, "General"),
              deadline: safeString(data.deadline, "Not specified"),
              location: safeString(data.location, "Not specified"),
              description: safeString(
                data.description,
                "No description available."
              ),
              eligibility: safeString(data.eligibility),
              requiredDocuments: getRequiredDocuments(
                data.requiredDocuments
              ),
              attachments: getAttachments(data.attachments),
              applicationStatus: getApplicationStatus(
                data.applicationStatus
              ),
              logo: getScholarshipLogo(data),
              coverImage: getScholarshipCover(data),
              isLocal: data.isLocal === true,
            };
          });

          setScholarships(list);
          setLoading(false);
        },
        (error) => {
          if (!active) return;

          console.error(
            "Error loading scholarships:",
            error.code,
            error.message
          );

          setLoading(false);
          setToastMessage(
            error.code === "permission-denied"
              ? "Access denied. Please check your Firestore Rules."
              : "Unable to load scholarships. Please try again."
          );
          setShowToast(true);
        }
      );

      const savedQuery = query(
        collection(db, "savedScholarships"),
        where("studentId", "==", user.uid)
      );

      unsubscribeSaved = onSnapshot(
        savedQuery,
        (snapshot) => {
          if (!active) return;

          const savedIds = snapshot.docs
            .map((item) => safeString(item.data().scholarshipId))
            .filter(Boolean);

          setSavedScholarships(savedIds);
        },
        (error) => {
          console.error("Error loading saved scholarships:", error);

          if (active) {
            setToastMessage(
              "Unable to load your saved scholarships. Please check your permissions."
            );
            setShowToast(true);
          }
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeScholarships?.();
      unsubscribeSaved?.();
    };
  }, []);

  // Search and category filters.
  const filteredScholarships = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return scholarships.filter((item) => {
      const searchableValues = [
        item.name,
        item.provider,
        item.type,
        item.description,
        item.location,
        item.amount,
      ];

      const matchesSearch =
        !keyword ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(keyword)
        );

      const normalizedType = item.type.toLowerCase();
      const normalizedLocation = item.location.toLowerCase();

      let matchesCategory = true;

      if (selectedCategory === "Academic") {
        matchesCategory = normalizedType.includes("academic");
      } else if (selectedCategory === "Financial Need") {
        matchesCategory =
          normalizedType.includes("financial") ||
          normalizedType.includes("need");
      } else if (selectedCategory === "Local") {
        matchesCategory =
          item.isLocal ||
          normalizedType.includes("local") ||
          normalizedLocation.includes("local");
      }

      return matchesSearch && matchesCategory;
    });
  }, [scholarships, searchText, selectedCategory]);

  const handleViewDetails = (item: Scholarship) => {
    setSelectedScholarship(item);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
  };

  // Save or remove scholarship.
  const handleToggleSave = async (item: Scholarship) => {
    if (!currentUserId) {
      setToastMessage("Please log in to save scholarships.");
      setShowToast(true);
      return;
    }

    if (savingScholarshipId) return;

    setSavingScholarshipId(item.id);

    const savedDocumentId = `${currentUserId}_${item.id}`;
    const savedDocumentRef = doc(
      db,
      "savedScholarships",
      savedDocumentId
    );

    try {
      const alreadySaved = savedScholarships.includes(item.id);

      if (alreadySaved) {
        await deleteDoc(savedDocumentRef);
        setToastMessage("Scholarship removed from your saved list.");
      } else {
        await setDoc(savedDocumentRef, {
          studentId: currentUserId,
          scholarshipId: item.id,
          scholarshipName: item.name,
          provider: item.provider,
          amount: item.amount,
          deadline: item.deadline,
          createdAt: serverTimestamp(),
        });

        setToastMessage("Scholarship saved successfully!");
      }

      setShowToast(true);
    } catch (error) {
      console.error("Error saving scholarship:", error);
      setToastMessage(
        "Unable to update saved scholarship. Please check your Firestore Rules."
      );
      setShowToast(true);
    } finally {
      setSavingScholarshipId(null);
    }
  };

  const handleApplyNow = () => {
    if (!selectedScholarship) return;

    const item = selectedScholarship;

    setShowDetails(false);

    navigate(
      `/application?scholarshipId=${encodeURIComponent(item.id)}`,
      {
        state: {
          scholarshipId: item.id,
          scholarshipName: item.name,
          provider: item.provider,
          deadline: item.deadline,
          amount: item.amount,
        },
      }
    );
  };

  const handleShare = async () => {
    if (!selectedScholarship) return;

    const item = selectedScholarship;
    const shareUrl = window.location.href;
    const shareText = `${item.name} - Offered by ${item.provider}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name,
          text: shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          `${shareText}\n${shareUrl}`
        );
        setToastMessage("Scholarship link copied!");
        setShowToast(true);
      } else {
        setToastMessage("Sharing is not supported on this device.");
        setShowToast(true);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Unable to share scholarship:", error);
        setToastMessage("Unable to share this scholarship.");
        setShowToast(true);
      }
    }
  };

  const handleSearchIconClick = () => {
    searchInputRef.current?.focus();
  };

  const selectedIsSaved = selectedScholarship
    ? savedScholarships.includes(selectedScholarship.id)
    : false;

  return (
    <IonPage className="scholarships-page">
      {/* Page header */}
      <header className="scholarships-top-header">
        <button
          type="button"
          className="scholarships-back-button app-back-control"
          aria-label="Go back"
          onClick={goBack}
        >
          <IonIcon icon={arrowBackOutline} />
        </button>

        <h1>Scholarships</h1>

        <button
          type="button"
          className="scholarships-header-search"
          aria-label="Focus search"
          onClick={handleSearchIconClick}
        >
          <IonIcon icon={searchOutline} />
        </button>
      </header>

      <IonContent className="scholarships-content">
        <main className="scholarships-container">
          {/* Search */}
          <section className="scholarships-search-section">
            <div className="scholarships-search-box">
              <IonIcon icon={searchOutline} />

              <input
                ref={searchInputRef}
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search scholarships..."
                aria-label="Search scholarships"
              />

              {searchText && (
                <button
                  type="button"
                  className="scholarships-clear-search"
                  aria-label="Clear search"
                  onClick={() => setSearchText("")}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div
              className="scholarships-category-filters"
              aria-label="Scholarship categories"
            >
              {CATEGORY_FILTERS.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`scholarships-category-chip ${
                    selectedCategory === category ? "active" : ""
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {/* Scholarship results */}
          <section className="scholarships-list-section">
            {!loading && (
              <div className="scholarships-results-heading">
                <span>
                  {filteredScholarships.length}{" "}
                  {filteredScholarships.length === 1
                    ? "scholarship"
                    : "scholarships"}{" "}
                  found
                </span>
              </div>
            )}

            {loading ? (
              <div className="scholarships-loading">
                <IonSpinner name="crescent" />
                <p>Loading scholarships...</p>
              </div>
            ) : filteredScholarships.length > 0 ? (
              <div className="scholarships-list">
                {filteredScholarships.map((item) => {
                  const isSaved = savedScholarships.includes(item.id);

                  return (
                    <article
                      className="scholarship-card"
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleViewDetails(item)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          handleViewDetails(item);
                        }
                      }}
                    >
                      <div className="scholarship-card-logo">
                        {item.logo ? (
                          <img
                            src={item.logo}
                            alt={`${item.provider} logo`}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <IonIcon icon={schoolOutline} />
                        )}
                      </div>

                      <div className="scholarship-card-content">
                        <h2>{item.name}</h2>

                        <p className="scholarship-card-amount">
                          <IonIcon icon={cashOutline} />
                          <span>{item.amount}</span>
                        </p>

                        <p className="scholarship-card-deadline">
                          <IonIcon icon={calendarOutline} />
                          <span>Deadline: {item.deadline}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`scholarship-bookmark-button ${
                          isSaved ? "is-saved" : ""
                        }`}
                        aria-label={
                          isSaved
                            ? "Remove saved scholarship"
                            : "Save scholarship"
                        }
                        aria-pressed={isSaved}
                        disabled={savingScholarshipId === item.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleSave(item);
                        }}
                      >
                        <IonIcon
                          icon={isSaved ? bookmark : bookmarkOutline}
                        />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="scholarships-empty-state">
                <div className="scholarships-empty-icon">
                  <IonIcon icon={schoolOutline} />
                </div>

                <h2>
                  {scholarships.length === 0
                    ? "No scholarships available yet"
                    : "No matching scholarships"}
                </h2>

                <p>
                  {scholarships.length === 0
                    ? "Published scholarship opportunities will appear here once they are available."
                    : "Try another keyword or choose a different category."}
                </p>

                {(searchText || selectedCategory !== "All") && (
                  <IonButton
                    fill="outline"
                    className="scholarships-clear-filters"
                    onClick={() => {
                      setSearchText("");
                      setSelectedCategory("All");
                    }}
                  >
                    Clear Filters
                  </IonButton>
                )}
              </div>
            )}
          </section>

          <div className="scholarships-bottom-space" />
        </main>
      </IonContent>

      {/* Full-screen scholarship details */}
      <IonModal
        isOpen={showDetails}
        onDidDismiss={() => {
          setShowDetails(false);
          setSelectedScholarship(null);
        }}
        className="scholarship-detail-fullscreen"
      >
        {selectedScholarship && (
          <div className="scholarship-detail-page">
            <IonContent className="scholarship-detail-content">
              {/* Cover image and floating controls */}
              <section className="scholarship-detail-hero">
                {selectedScholarship.coverImage ? (
                  <img
                    className="scholarship-detail-cover"
                    src={selectedScholarship.coverImage}
                    alt={`${selectedScholarship.name} cover`}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="scholarship-detail-cover-fallback">
                    <IonIcon icon={schoolOutline} />
                    <span>GrantAccess Scholarship</span>
                  </div>
                )}

                <div className="scholarship-detail-hero-shade" />

                <button
                  type="button"
                  className="scholarship-detail-back"
                  aria-label="Back to scholarships"
                  onClick={closeDetails}
                >
                  <IonIcon icon={arrowBackOutline} />
                </button>

                <button
                  type="button"
                  className="scholarship-detail-share"
                  aria-label="Share scholarship"
                  onClick={() => void handleShare()}
                >
                  <IonIcon icon={shareSocialOutline} />
                </button>
              </section>

              {/* Main detail card */}
              <main className="scholarship-detail-main">
                <section className="scholarship-detail-card">
                  <div className="scholarship-detail-heading">
                    <div className="scholarship-detail-provider-logo">
                      {selectedScholarship.logo ? (
                        <img
                          src={selectedScholarship.logo}
                          alt={`${selectedScholarship.provider} logo`}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <IonIcon icon={schoolOutline} />
                      )}
                    </div>

                    <div className="scholarship-detail-title-area">
                      <h1>{selectedScholarship.name}</h1>
                      <p className="scholarship-detail-amount">
                        {selectedScholarship.amount}
                      </p>
                    </div>
                  </div>

                  {/* Scholarship information */}
                  <div className="scholarship-detail-information">
                    <div className="scholarship-detail-info-row">
                      <span className="scholarship-detail-info-icon">
                        <IonIcon icon={calendarOutline} />
                      </span>
                      <span className="scholarship-detail-info-label">
                        Deadline
                      </span>
                      <strong>{selectedScholarship.deadline}</strong>
                    </div>

                    <div className="scholarship-detail-info-row">
                      <span className="scholarship-detail-info-icon">
                        <IonIcon icon={businessOutline} />
                      </span>
                      <span className="scholarship-detail-info-label">
                        Provider
                      </span>
                      <strong>{selectedScholarship.provider}</strong>
                    </div>

                    <div className="scholarship-detail-info-row">
                      <span className="scholarship-detail-info-icon">
                        <IonIcon icon={schoolOutline} />
                      </span>
                      <span className="scholarship-detail-info-label">
                        Type
                      </span>
                      <strong>{selectedScholarship.type}</strong>
                    </div>

                    <div className="scholarship-detail-info-row">
                      <span className="scholarship-detail-info-icon">
                        <IonIcon icon={locationOutline} />
                      </span>
                      <span className="scholarship-detail-info-label">
                        Location
                      </span>
                      <strong>{selectedScholarship.location}</strong>
                    </div>
                  </div>

                  {/* About */}
                  <section className="scholarship-detail-about">
                    <h2>About This Scholarship</h2>
                    <p>{selectedScholarship.description}</p>
                  </section>

                  {/* Eligibility */}
                  {selectedScholarship.eligibility && (
                    <section className="scholarship-detail-extra-section">
                      <h2>Eligibility</h2>
                      <p>{selectedScholarship.eligibility}</p>
                    </section>
                  )}

                  {/* Required documents */}
                  {selectedScholarship.requiredDocuments.length > 0 && (
                    <section className="scholarship-detail-extra-section">
                      <h2>Documents to Submit</h2>

                      <ul className="scholarship-document-requirements">
                        {selectedScholarship.requiredDocuments.map(
                          (document, index) => (
                            <li key={`${document}-${index}`}>
                              <IonIcon icon={documentTextOutline} />
                              <span>{document}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </section>
                  )}

                  {/* Downloadable forms */}
                  {selectedScholarship.attachments.length > 0 && (
                    <section className="scholarship-detail-extra-section">
                      <h2>Downloadable Forms</h2>

                      <div className="scholarship-download-list">
                        {selectedScholarship.attachments.map(
                          (file, index) => (
                            <StudentDocumentAccess
                              key={`${file.url}-${index}`}
                              document={file}
                            />
                          )
                        )}
                      </div>
                    </section>
                  )}
                </section>

                {/* Bottom action buttons */}
                <div className="scholarship-detail-actions">
                  <IonButton
                    expand="block"
                    className="scholarship-detail-apply-button"
                    onClick={handleApplyNow}
                    disabled={
                      selectedScholarship.applicationStatus !== "open"
                    }
                  >
                    {selectedScholarship.applicationStatus === "closed"
                      ? "Applications Closed"
                      : selectedScholarship.applicationStatus === "upcoming"
                        ? "Applications Not Open Yet"
                        : "Apply Now"}
                  </IonButton>

                  <button
                    type="button"
                    className={`scholarship-detail-save-button ${
                      selectedIsSaved ? "is-saved" : ""
                    }`}
                    aria-label={
                      selectedIsSaved
                        ? "Remove from saved scholarships"
                        : "Save scholarship"
                    }
                    aria-pressed={selectedIsSaved}
                    disabled={
                      savingScholarshipId === selectedScholarship.id
                    }
                    onClick={() =>
                      void handleToggleSave(selectedScholarship)
                    }
                  >
                    <IonIcon
                      icon={selectedIsSaved ? bookmark : bookmarkOutline}
                    />
                  </button>
                </div>
              </main>
            </IonContent>
          </div>
        )}
      </IonModal>

      <StudentBottomNav />

      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={3500}
        position="top"
        onDidDismiss={() => setShowToast(false)}
      />
    </IonPage>
  );
};

export default Scholarships;