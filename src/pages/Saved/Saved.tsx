import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from "@ionic/react";

import {
  bookmark,
  schoolOutline,
  documentTextOutline,
  chevronDownOutline,
  chevronUpOutline,
  openOutline,
} from "ionicons/icons";

import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../../Firebase/config";
import StudentHeader from "../../components/StudentHeader";
import StudentBottomNav from "../../components/StudentBottomNav";
import "./Saved.css";

interface SavedScholarship {
  id: string;
  studentId?: string;
  scholarshipId?: string;
  scholarshipName?: string;
  scholarshipTitle?: string;
  name?: string;
  title?: string;
  provider?: string;
  organizationName?: string;
  amount?: string | number;
  description?: string;
  deadline?: string;
  logoUrl?: string;
  logoURL?: string;
  scholarshipLogo?: string;
  organizationLogo?: string;
  organizationLogoUrl?: string;
  providerLogo?: string;
  providerLogoUrl?: string;
  imageUrl?: string;
  image?: string;
  logo?: string;
}

interface SavedPost {
  id: string;
  studentId?: string;
  postId?: string;
  title?: string;
  provider?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

interface SavedOrganization {
  id: string;
  studentId?: string;
  organizationId?: string;
  organizationName?: string;
  organizationType?: string;
  logoUrl?: string;
  address?: string;
  description?: string;
}

type SavedCollection =
  | "savedScholarships"
  | "savedPosts"
  | "savedOrganizations";

const getScholarshipTitle = (item: SavedScholarship) =>
  item.scholarshipName ||
  item.scholarshipTitle ||
  item.name ||
  item.title ||
  "Scholarship";

const getFirstLogo = (data: Record<string, unknown>): string => {
  const possibleLogos = [
    data.logoUrl,
    data.logoURL,
    data.scholarshipLogo,
    data.organizationLogo,
    data.organizationLogoUrl,
    data.providerLogo,
    data.providerLogoUrl,
    data.imageUrl,
    data.image,
    data.logo,
    data.orgLogo,
    data.providerImage,
  ];

  return (
    possibleLogos.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    ) || ""
  );
};

const formatAmount = (amount?: string | number) => {
  if (amount === undefined || amount === null || amount === "") {
    return "";
  }

  if (typeof amount === "number") {
    return `₱${amount.toLocaleString("en-PH")}`;
  }

  return amount;
};

const Saved: React.FC = () => {
  const navigate = useNavigate();

  const [scholarships, setScholarships] = useState<SavedScholarship[]>([]);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [organizations, setOrganizations] = useState<SavedOrganization[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribePosts: (() => void) | undefined;
    let unsubscribeOrganizations: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeOrganizations?.();

      unsubscribeScholarships = undefined;
      unsubscribePosts = undefined;
      unsubscribeOrganizations = undefined;

      if (!active) return;

      if (!user) {
        setScholarships([]);
        setPosts([]);
        setOrganizations([]);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");
      setExpandedItem(null);

      let loadedScholarships = false;
      let loadedPosts = false;
      let loadedOrganizations = false;

      const checkAllLoaded = () => {
        if (
          active &&
          loadedScholarships &&
          loadedPosts &&
          loadedOrganizations
        ) {
          setLoading(false);
        }
      };

      // SAVED SCHOLARSHIPS
      const scholarshipQuery = query(
        collection(db, "savedScholarships"),
        where("studentId", "==", user.uid)
      );

      unsubscribeScholarships = onSnapshot(
        scholarshipQuery,
        async (snapshot) => {
          if (!active) return;

          try {
            const items = await Promise.all(
              snapshot.docs.map(async (savedDoc) => {
                const savedData = savedDoc.data() as Record<string, unknown>;

                const scholarshipId =
                  typeof savedData.scholarshipId === "string"
                    ? savedData.scholarshipId
                    : savedDoc.id;

                let originalData: Record<string, unknown> = {};

                // Kunin ang original scholarship document para sa logo
                // at iba pang details na maaaring hindi kasama sa saved document.
                try {
                  const originalRef = doc(
                    db,
                    "scholarships",
                    scholarshipId
                  );

                  const originalSnapshot = await getDoc(originalRef);

                  if (originalSnapshot.exists()) {
                    originalData = originalSnapshot.data() as Record<
                      string,
                      unknown
                    >;
                  }
                } catch (fetchError) {
                  console.warn(
                    `Unable to fetch original scholarship ${scholarshipId}:`,
                    fetchError
                  );
                }

                const mergedData = {
                  ...originalData,
                  ...savedData,
                };

                const logo =
                  getFirstLogo(savedData) || getFirstLogo(originalData);

                return {
                  ...mergedData,
                  id: savedDoc.id,
                  scholarshipId,
                  logoUrl: logo,
                } as SavedScholarship;
              })
            );

            if (!active) return;

            setScholarships(items);
          } catch (snapshotError) {
            console.error(
              "Error processing saved scholarships:",
              snapshotError
            );

            if (active) {
              setError("Unable to load saved scholarships.");
            }
          } finally {
            loadedScholarships = true;
            checkAllLoaded();
          }
        },
        (snapshotError) => {
          if (!active) return;

          console.error("Error loading saved scholarships:", snapshotError);
          setError(
            "Unable to load saved scholarships. Please check your Firestore rules."
          );

          loadedScholarships = true;
          checkAllLoaded();
        }
      );

      // SAVED POSTS
      const postQuery = query(
        collection(db, "savedPosts"),
        where("studentId", "==", user.uid)
      );

      unsubscribePosts = onSnapshot(
        postQuery,
        (snapshot) => {
          if (!active) return;

          const items: SavedPost[] = snapshot.docs.map((savedDoc) => ({
            ...savedDoc.data(),
            id: savedDoc.id,
          })) as SavedPost[];

          setPosts(items);
          loadedPosts = true;
          checkAllLoaded();
        },
        (snapshotError) => {
          if (!active) return;

          console.error("Error loading saved posts:", snapshotError);
          setError("Unable to load saved posts. Please check your Firestore rules.");

          loadedPosts = true;
          checkAllLoaded();
        }
      );

      // SAVED ORGANIZATIONS
      const organizationQuery = query(
        collection(db, "savedOrganizations"),
        where("studentId", "==", user.uid)
      );

      unsubscribeOrganizations = onSnapshot(
        organizationQuery,
        (snapshot) => {
          if (!active) return;

          const items: SavedOrganization[] = snapshot.docs.map(
            (savedDoc) => ({
              ...savedDoc.data(),
              id: savedDoc.id,
            })
          ) as SavedOrganization[];

          setOrganizations(items);
          loadedOrganizations = true;
          checkAllLoaded();
        },
        (snapshotError) => {
          if (!active) return;

          console.error("Error loading saved organizations:", snapshotError);
          setError(
            "Unable to load saved organizations. Please check your Firestore rules."
          );

          loadedOrganizations = true;
          checkAllLoaded();
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeScholarships?.();
      unsubscribePosts?.();
      unsubscribeOrganizations?.();
    };
  }, [navigate]);

  const totalSaved =
    scholarships.length + posts.length + organizations.length;

  const toggleDetails = (itemKey: string) => {
    setExpandedItem((current) =>
      current === itemKey ? null : itemKey
    );
  };

  const removeSavedItem = async (
    collectionName: SavedCollection,
    savedId: string,
    itemKey: string
  ) => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setRemovingId(itemKey);
      setError("");

      await deleteDoc(doc(db, collectionName, savedId));

      setExpandedItem((current) =>
        current === itemKey ? null : current
      );
    } catch (removeError) {
      console.error("Unable to remove saved item:", removeError);
      setError("Unable to unsave this item. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <IonPage className="saved-page">
      <StudentHeader />

      <IonContent className="saved-content">
        <main className="saved-container">
          <header className="saved-heading">
            <div>
              <h1>Saved</h1>
              <p>Your saved scholarships, posts, and organizations.</p>
            </div>

            <div
              className="saved-count"
              aria-label={`${totalSaved} saved items`}
            >
              <IonIcon icon={bookmark} />
              <span>{totalSaved}</span>
            </div>
          </header>

          {error && (
            <div className="saved-error" role="alert">
              {error}
            </div>
          )}

          {loading && (
            <div className="saved-message" role="status">
              <IonSpinner name="crescent" />
              <p>Loading your saved items...</p>
            </div>
          )}

          {!loading && totalSaved === 0 && (
            <section className="saved-empty">
              <div className="saved-empty-icon">
                <IonIcon icon={bookmark} />
              </div>

              <h2>No saved items yet</h2>
              <p>
                Scholarships, posts, and organizations you bookmark
                will appear here.
              </p>

              <button
                type="button"
                className="saved-primary-button"
                onClick={() => navigate("/scholarships")}
              >
                Browse Scholarships
              </button>
            </section>
          )}

          {/* SAVED SCHOLARSHIPS */}
          {!loading && scholarships.length > 0 && (
            <section className="saved-section">
              <div className="saved-section-heading">
                <div className="saved-section-icon">
                  <IonIcon icon={schoolOutline} />
                </div>

                <div>
                  <h2>Saved Scholarships</h2>
                  <p>
                    {scholarships.length}{" "}
                    {scholarships.length === 1
                      ? "scholarship"
                      : "scholarships"}{" "}
                    found
                  </p>
                </div>
              </div>

              <div className="saved-list">
                {scholarships.map((scholarship) => {
                  const itemKey = `scholarship-${scholarship.id}`;
                  const isExpanded = expandedItem === itemKey;
                  const title = getScholarshipTitle(scholarship);
                  const logo = scholarship.logoUrl || "";

                  return (
                    <article
                      className="saved-scholarship-card"
                      key={scholarship.id}
                    >
                      <div className="saved-scholarship-main">
                        <div className="saved-scholarship-logo">
                          {logo ? (
                            <img
                              src={logo}
                              alt={`${title} logo`}
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <IonIcon icon={schoolOutline} />
                          )}
                        </div>

                        <div className="saved-scholarship-info">
                          <h3>{title}</h3>

                          {scholarship.amount !== undefined &&
                            scholarship.amount !== "" && (
                              <p className="saved-scholarship-amount">
                                <span className="saved-amount-icon">₱</span>
                                {formatAmount(scholarship.amount)}
                              </p>
                            )}

                          {scholarship.deadline && (
                            <p className="saved-scholarship-deadline">
                              <span className="saved-calendar-symbol">▣</span>
                              Deadline: {scholarship.deadline}
                            </p>
                          )}

                          {(scholarship.provider ||
                            scholarship.organizationName) && (
                            <p className="saved-scholarship-provider">
                              {scholarship.provider ||
                                scholarship.organizationName}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          className="saved-bookmark-button"
                          aria-label={`Unsave ${title}`}
                          title="Unsave scholarship"
                          disabled={removingId === itemKey}
                          onClick={() =>
                            void removeSavedItem(
                              "savedScholarships",
                              scholarship.id,
                              itemKey
                            )
                          }
                        >
                          {removingId === itemKey ? (
                            <IonSpinner name="crescent" />
                          ) : (
                            <IonIcon icon={bookmark} />
                          )}
                        </button>
                      </div>

                      <div className="saved-card-footer">
                        <button
                          type="button"
                          className="saved-view-button"
                          onClick={() => toggleDetails(itemKey)}
                        >
                          {isExpanded ? "Hide details" : "View details"}
                          <IonIcon
                            icon={
                              isExpanded
                                ? chevronUpOutline
                                : chevronDownOutline
                            }
                          />
                        </button>

                        <button
                          type="button"
                          className="saved-open-button"
                          onClick={() =>
                            navigate("/scholarships", {
                              state: {
                                scholarshipId:
                                  scholarship.scholarshipId ||
                                  scholarship.id,
                              },
                            })
                          }
                        >
                          View scholarship
                          <IonIcon icon={openOutline} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="saved-expanded-details">
                          {(scholarship.provider ||
                            scholarship.organizationName) && (
                            <p>
                              <strong>Provider:</strong>{" "}
                              {scholarship.provider ||
                                scholarship.organizationName}
                            </p>
                          )}

                          {scholarship.amount !== undefined &&
                            scholarship.amount !== "" && (
                              <p>
                                <strong>Amount:</strong>{" "}
                                {formatAmount(scholarship.amount)}
                              </p>
                            )}

                          {scholarship.deadline && (
                            <p>
                              <strong>Deadline:</strong>{" "}
                              {scholarship.deadline}
                            </p>
                          )}

                          <p>
                            <strong>Description:</strong>{" "}
                            {scholarship.description ||
                              "No description available."}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* SAVED POSTS */}
          {!loading && posts.length > 0 && (
            <section className="saved-section">
              <div className="saved-section-heading">
                <div className="saved-section-icon post-section-icon">
                  <IonIcon icon={documentTextOutline} />
                </div>

                <div>
                  <h2>Saved Posts</h2>
                  <p>{posts.length} saved</p>
                </div>
              </div>

              <div className="saved-list">
                {posts.map((post) => {
                  const itemKey = `post-${post.id}`;
                  const isExpanded = expandedItem === itemKey;

                  return (
                    <article className="saved-simple-card" key={post.id}>
                      <div className="saved-simple-main">
                        <div className="saved-simple-icon">
                          {post.imageUrl ? (
                            <img src={post.imageUrl} alt="" />
                          ) : (
                            <IonIcon icon={documentTextOutline} />
                          )}
                        </div>

                        <div className="saved-simple-info">
                          <h3>{post.title || "Organization Update"}</h3>
                          <p>
                            {post.provider ||
                              post.category ||
                              "Organization post"}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="saved-bookmark-button"
                          aria-label={`Unsave ${post.title || "post"}`}
                          disabled={removingId === itemKey}
                          onClick={() =>
                            void removeSavedItem(
                              "savedPosts",
                              post.id,
                              itemKey
                            )
                          }
                        >
                          {removingId === itemKey ? (
                            <IonSpinner name="crescent" />
                          ) : (
                            <IonIcon icon={bookmark} />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="saved-view-button"
                        onClick={() => toggleDetails(itemKey)}
                      >
                        {isExpanded ? "Hide details" : "View details"}
                        <IonIcon
                          icon={
                            isExpanded
                              ? chevronUpOutline
                              : chevronDownOutline
                          }
                        />
                      </button>

                      {isExpanded && (
                        <div className="saved-expanded-details">
                          {post.category && (
                            <p>
                              <strong>Category:</strong> {post.category}
                            </p>
                          )}

                          {post.imageUrl && (
                            <img
                              className="saved-post-image"
                              src={post.imageUrl}
                              alt={post.title || "Saved post"}
                            />
                          )}

                          <p>
                            <strong>Description:</strong>{" "}
                            {post.description || "No description available."}
                          </p>

                          <button
                            type="button"
                            className="saved-detail-link"
                            onClick={() =>
                              navigate("/student-dashboard", {
                                state: { postId: post.postId || post.id },
                              })
                            }
                          >
                            View in feed <IonIcon icon={openOutline} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* SAVED ORGANIZATIONS */}
          {!loading && organizations.length > 0 && (
            <section className="saved-section">
              <div className="saved-section-heading">
                <div className="saved-section-icon">
                  <IonIcon icon={schoolOutline} />
                </div>

                <div>
                  <h2>Saved Organizations</h2>
                  <p>{organizations.length} saved</p>
                </div>
              </div>

              <div className="saved-list">
                {organizations.map((organization) => {
                  const itemKey = `organization-${organization.id}`;
                  const isExpanded = expandedItem === itemKey;

                  return (
                    <article className="saved-simple-card" key={organization.id}>
                      <div className="saved-simple-main">
                        <div className="saved-simple-icon">
                          {organization.logoUrl ? (
                            <img
                              src={organization.logoUrl}
                              alt={`${organization.organizationName || "Organization"} logo`}
                            />
                          ) : (
                            <IonIcon icon={schoolOutline} />
                          )}
                        </div>

                        <div className="saved-simple-info">
                          <h3>
                            {organization.organizationName || "Organization"}
                          </h3>
                          <p>
                            {organization.organizationType || "Organization"}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="saved-bookmark-button"
                          aria-label={`Unsave ${
                            organization.organizationName || "organization"
                          }`}
                          disabled={removingId === itemKey}
                          onClick={() =>
                            void removeSavedItem(
                              "savedOrganizations",
                              organization.id,
                              itemKey
                            )
                          }
                        >
                          {removingId === itemKey ? (
                            <IonSpinner name="crescent" />
                          ) : (
                            <IonIcon icon={bookmark} />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="saved-view-button"
                        onClick={() => toggleDetails(itemKey)}
                      >
                        {isExpanded ? "Hide details" : "View details"}
                        <IonIcon
                          icon={
                            isExpanded
                              ? chevronUpOutline
                              : chevronDownOutline
                          }
                        />
                      </button>

                      {isExpanded && (
                        <div className="saved-expanded-details">
                          {organization.address && (
                            <p>
                              <strong>Address:</strong> {organization.address}
                            </p>
                          )}

                          {organization.description && (
                            <p>
                              <strong>About:</strong>{" "}
                              {organization.description}
                            </p>
                          )}

                          <button
                            type="button"
                            className="saved-detail-link"
                            disabled={!organization.organizationId}
                            onClick={() =>
                              navigate(
                                `/organization-profile/${encodeURIComponent(
                                  organization.organizationId || ""
                                )}`
                              )
                            }
                          >
                            View organization profile
                            <IonIcon icon={openOutline} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </IonContent>

      <StudentBottomNav />
    </IonPage>
  );
};

export default Saved;