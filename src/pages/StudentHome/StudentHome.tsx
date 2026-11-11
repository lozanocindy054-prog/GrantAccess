import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast,
} from "@ionic/react";

import {
  schoolOutline,
  documentTextOutline,
  timeOutline,
  bookmarkOutline,
  calendarOutline,
  notificationsOutline,
  chatbubbleOutline,
  personCircleOutline,
  trophyOutline,
  chevronForwardOutline,
  locationOutline,
  mapOutline,
  navigateOutline,
} from "ionicons/icons";

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../Firebase/config";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import StudentBottomNav from "../../components/StudentBottomNav";

import "./StudentHome.css";

// ==========================================
// TYPES
// ==========================================

interface Scholarship {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  organizationId: string;
  amount: string | number;
  deadline: string;
  location: string;
  category: string;
  status: string;
  organizationLogo?: string;
  applicationStatus: "open" | "closed" | "upcoming";
}

interface Application {
  id: string;
  studentId: string;
  status: string;
}

interface SavedScholarship {
  id: string;
  studentId: string;
}

interface Organization {
  id: string;
  organizationName: string;
  organizationType: string;
  address: string;
  latitude: number;
  longitude: number;
  logo?: string;
}

// ==========================================
// MAP MARKER ICON
// ==========================================

const organizationMarker = L.divIcon({
  className: "grantaccess-map-marker-wrapper",
  html: `
    <div class="grantaccess-map-marker">
      <span>🏫</span>
    </div>
  `,
  iconSize: [38, 46],
  iconAnchor: [19, 43],
  popupAnchor: [0, -40],
});

// ==========================================
// HELPERS
// ==========================================

const formatDate = (value: unknown): string => {
  if (!value) return "Not specified";

  try {
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date })
        .toDate()
        .toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    }

    if (value instanceof Date) {
      return value.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    if (typeof value === "string") {
      const parsed = new Date(value);

      if (Number.isNaN(parsed.getTime())) return value;

      return parsed.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return "Not specified";
  } catch {
    return "Not specified";
  }
};

const formatAmount = (amount: string | number): string => {
  if (typeof amount === "number") {
    return `₱${amount.toLocaleString("en-PH")}`;
  }

  const numericAmount = Number(amount);

  if (amount && Number.isFinite(numericAmount)) {
    return `₱${numericAmount.toLocaleString("en-PH")}`;
  }

  return amount || "Not specified";
};

const getApplicationStatus = (
  value: unknown
): Scholarship["applicationStatus"] => {
  const status = String(value || "open").toLowerCase();

  if (status === "closed") return "closed";
  if (status === "upcoming") return "upcoming";

  return "open";
};

const getNestedValue = (
  data: Record<string, unknown>,
  path: string
): unknown => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (
      current &&
      typeof current === "object" &&
      key in current
    ) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, data);
};

const getCoordinate = (
  data: Record<string, unknown>,
  keys: string[]
): number | null => {
  for (const key of keys) {
    const value = getNestedValue(data, key);

    if (value !== undefined && value !== null && value !== "") {
      const coordinate = Number(value);

      if (Number.isFinite(coordinate)) {
        return coordinate;
      }
    }
  }

  return null;
};

const getOrganizationAddress = (
  data: Record<string, unknown>
): string => {
  const possibleAddresses = [
    data.address,
    data.organizationAddress,
    data.fullAddress,
    data.completeAddress,
    data.location,
    getNestedValue(data, "location.address"),
    getNestedValue(data, "location.formattedAddress"),
  ];

  for (const address of possibleAddresses) {
    if (typeof address === "string" && address.trim()) {
      return address.trim();
    }
  }

  return "Address not provided";
};

const openGoogleMaps = (
  latitude: number,
  longitude: number
) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  window.open(url, "_blank", "noopener,noreferrer");
};

// ==========================================
// STUDENT HOME
// ==========================================

const StudentHome: React.FC = () => {
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState("Student");
  const [studentPhoto, setStudentPhoto] = useState("");

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedScholarships, setSavedScholarships] = useState<SavedScholarship[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // ========================================
  // AUTHENTICATION AND FIRESTORE LISTENERS
  // ========================================

  useEffect(() => {
    let active = true;
    let authGeneration = 0;

    let unsubscribeStudentProfile: (() => void) | undefined;
    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribeApplications: (() => void) | undefined;
    let unsubscribeSaved: (() => void) | undefined;
    let unsubscribeOrganizations: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const currentGeneration = ++authGeneration;

      // CLEANUP PREVIOUS LISTENERS

      unsubscribeStudentProfile?.();
      unsubscribeScholarships?.();
      unsubscribeApplications?.();
      unsubscribeSaved?.();
      unsubscribeOrganizations?.();
      unsubscribeNotifications?.();

      unsubscribeStudentProfile = undefined;
      unsubscribeScholarships = undefined;
      unsubscribeApplications = undefined;
      unsubscribeSaved = undefined;
      unsubscribeOrganizations = undefined;
      unsubscribeNotifications = undefined;

      if (!active) return;

      // NO SIGNED-IN USER

      if (!user) {
        setStudentName("Student");
        setStudentPhoto("");

        setScholarships([]);
        setApplications([]);
        setSavedScholarships([]);
        setOrganizations([]);
        setUnreadNotifications(0);

        setLoading(false);
        setMapLoading(false);

        setErrorMessage("Please sign in to view your dashboard.");
        return;
      }

      setLoading(true);
      setMapLoading(true);
      setMapError("");
      setErrorMessage("");

      setStudentName(user.displayName || "Student");
      setStudentPhoto(user.photoURL || "");

      // ========================================
      // STUDENT PROFILE - REAL-TIME LISTENER
      // ========================================

      unsubscribeStudentProfile = onSnapshot(
        doc(db, "students", user.uid),
        (studentSnapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          if (studentSnapshot.exists()) {
            const studentData = studentSnapshot.data();

            setStudentName(
              studentData.fullName ||
                studentData.name ||
                user.displayName ||
                "Student"
            );

            setStudentPhoto(
              studentData.photoURL ||
                studentData.profilePhoto ||
                studentData.profileImage ||
                studentData.avatarUrl ||
                user.photoURL ||
                ""
            );
          } else {
            setStudentName(user.displayName || "Student");
            setStudentPhoto(user.photoURL || "");
          }
        },
        (error) => {
          console.error("Student profile listener error:", error);

          if (active && currentGeneration === authGeneration) {
            setStudentName(user.displayName || "Student");
            setStudentPhoto(user.photoURL || "");
          }
        }
      );

      // ========================================
      // PUBLISHED SCHOLARSHIPS
      // ========================================

      unsubscribeScholarships = onSnapshot(
        query(
          collection(db, "scholarships"),
          where("status", "==", "published")
        ),
        (snapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          const scholarshipData: Scholarship[] = snapshot.docs.map((item) => {
            const data = item.data();

            return {
              id: item.id,

              title:
                data.title ||
                data.scholarshipName ||
                data.name ||
                "Untitled Scholarship",

              description:
                data.description || "No description available.",

              organizationName:
                data.organizationName ||
                data.provider ||
                data.providerName ||
                "Participating Organization",

              organizationId:
                data.organizationId ||
                data.providerId ||
                "",

              amount:
                data.amount ??
                data.scholarshipAmount ??
                "Not specified",

              deadline: formatDate(data.deadline),
              location: data.location || "Not specified",
              category: data.category || data.type || "General",
              status: data.status || "",

              organizationLogo:
                data.organizationLogo ||
                data.organizationLogoUrl ||
                data.logoUrl ||
                "",

              applicationStatus: getApplicationStatus(
                data.applicationStatus
              ),
            };
          });

          setScholarships(scholarshipData);
          setLoading(false);
        },
        (error) => {
          console.error("Scholarships listener error:", error);

          if (active && currentGeneration === authGeneration) {
            setErrorMessage(
              "Unable to load scholarships. Please check your Firestore Rules."
            );

            setLoading(false);
          }
        }
      );

      // ========================================
      // STUDENT APPLICATIONS
      // ========================================

      unsubscribeApplications = onSnapshot(
        query(
          collection(db, "applications"),
          where("studentId", "==", user.uid)
        ),
        (snapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          const applicationData: Application[] = snapshot.docs.map((item) => {
            const data = item.data();

            return {
              id: item.id,
              studentId: data.studentId || user.uid,
              status: String(data.status || "Pending"),
            };
          });

          setApplications(applicationData);
        },
        (error) => {
          console.error("Applications listener error:", error);

          if (active && currentGeneration === authGeneration) {
            setErrorMessage(
              "Unable to load your application statistics."
            );
          }
        }
      );

      // ========================================
      // SAVED SCHOLARSHIPS
      // ========================================

      unsubscribeSaved = onSnapshot(
        query(
          collection(db, "savedScholarships"),
          where("studentId", "==", user.uid)
        ),
        (snapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          setSavedScholarships(
            snapshot.docs.map((item) => ({
              id: item.id,
              studentId: item.data().studentId || user.uid,
            }))
          );
        },
        (error) => {
          console.error("Saved scholarships listener error:", error);
        }
      );

      // ========================================
      // UNREAD NOTIFICATIONS (BELL INDICATOR)
      // ========================================

      unsubscribeNotifications = onSnapshot(
        query(
          collection(db, "studentNotifications"),
          where("studentId", "==", user.uid)
        ),
        (snapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          setUnreadNotifications(
            snapshot.docs.filter((item) => item.data().isRead !== true)
              .length
          );
        },
        (error) => {
          console.error("Notifications listener error:", error);
        }
      );

      // ========================================
      // REGISTERED ORGANIZATIONS MAP
      // ========================================

      unsubscribeOrganizations = onSnapshot(
        collection(db, "organizations"),
        (snapshot) => {
          if (!active || currentGeneration !== authGeneration) return;

          const organizationData: Organization[] =
            snapshot.docs.flatMap((item): Organization[] => {
              const data = item.data();

              const latitude = getCoordinate(data, [
                "latitude",
                "lat",
                "coordinates.latitude",
                "location.latitude",
                "location.lat",
                "geoPoint.latitude",
              ]);

              const longitude = getCoordinate(data, [
                "longitude",
                "lng",
                "long",
                "coordinates.longitude",
                "location.longitude",
                "location.lng",
                "geoPoint.longitude",
              ]);

              if (
                latitude === null ||
                longitude === null ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
              ) {
                return [];
              }

              return [
                {
                  id: item.id,

                  organizationName: String(
                    data.organizationName ||
                      data.orgName ||
                      data.name ||
                      data.schoolName ||
                      "Unnamed Organization"
                  ),

                  organizationType: String(
                    data.organizationType ||
                      data.accountType ||
                      data.type ||
                      data.role ||
                      "Organization"
                  ),

                  address: getOrganizationAddress(data),
                  latitude,
                  longitude,

                  logo: String(
                    data.logoUrl ||
                      data.organizationLogo ||
                      data.photoURL ||
                      ""
                  ),
                },
              ];
            });

          setOrganizations(organizationData);
          setMapLoading(false);
          setMapError("");
        },
        (error) => {
          console.error("Organization map listener error:", error);

          if (active && currentGeneration === authGeneration) {
            setMapLoading(false);

            setMapError(
              "Unable to load organizations. Please check your Firestore Rules."
            );
          }
        }
      );
    });

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      active = false;
      authGeneration++;

      unsubscribeAuth();

      unsubscribeStudentProfile?.();
      unsubscribeScholarships?.();
      unsubscribeApplications?.();
      unsubscribeSaved?.();
      unsubscribeOrganizations?.();
      unsubscribeNotifications?.();
    };
  }, []);

  // ========================================
  // DASHBOARD COUNTS
  // ========================================

  const pendingApplications = useMemo(
    () =>
      applications.filter(
        (application) =>
          application.status.toLowerCase() === "pending"
      ).length,
    [applications]
  );

  const availableScholarships = useMemo(
    () =>
      scholarships.filter(
        (scholarship) =>
          scholarship.applicationStatus === "open"
      ).length,
    [scholarships]
  );

  // ========================================
  // FEATURED SCHOLARSHIPS
  // ========================================

  const featuredScholarships = useMemo(
    () => scholarships.slice(0, 3),
    [scholarships]
  );

  // ========================================
  // ORGANIZATION MAP CENTER
  // ========================================

  const mapCenter = useMemo<[number, number]>(() => {
    if (organizations.length > 0) {
      return [
        organizations[0].latitude,
        organizations[0].longitude,
      ];
    }

    return [12.8797, 121.774];
  }, [organizations]);

  // ========================================
  // NAVIGATION
  // ========================================

  const openScholarships = () => navigate("/scholarships");

  const openScholarshipDetails = (id: string) => {
    navigate(`/application?scholarshipId=${encodeURIComponent(id)}`);
  };

  const openApplications = () => navigate("/application-history");

  const openSaved = () => navigate("/saved");

  const openProfile = () => navigate("/profile");

  const openNotifications = () => navigate("/notifications");

  // ========================================
  // UI
  // ========================================

  return (
    <IonPage className="student-home-page">
      <IonContent
        fullscreen
        className="student-home-content"
        scrollY={true}
      >
        <div className="student-home">

          {/* HEADER */}

          <header className="student-home-topbar">
            <div className="student-home-topbar-spacer" />

            <button
              type="button"
              className="student-message-button"
              aria-label="Messages"
              onClick={() => navigate("/student-messages")}
            >
              <IonIcon icon={chatbubbleOutline} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="student-notification-button"
              aria-label={
                unreadNotifications > 0
                  ? `Notifications, ${unreadNotifications} unread`
                  : "Notifications"
              }
              onClick={openNotifications}
            >
              <IonIcon icon={notificationsOutline} />
              {unreadNotifications > 0 && (
                <span className="notification-indicator" />
              )}
            </button>
          </header>

          {/* WELCOME */}

          <section className="student-welcome-section">
            <div className="student-welcome-copy">
              <p className="student-welcome-eyebrow">
                STUDENT DASHBOARD
              </p>

              <h1>Hello, {studentName.split(" ")[0]}!</h1>

              <p>
                Find your scholarship,
                <br />
                build your future.
              </p>
            </div>

            {/* STUDENT PROFILE AVATAR */}

            <button
              type="button"
              className="student-profile-avatar"
              onClick={openProfile}
              aria-label="Open student profile"
            >
              {studentPhoto ? (
                <img
                  src={studentPhoto}
                  alt={`${studentName} profile`}
                  onError={() => setStudentPhoto("")}
                />
              ) : (
                <IonIcon icon={personCircleOutline} />
              )}

              <span className="student-avatar-edit">
                <IonIcon icon={personCircleOutline} />
              </span>
            </button>
          </section>

          {/* SCHOLARSHIP RECOMMENDATION BANNER */}

          <section className="student-recommendation-banner">
            <div className="recommendation-banner-content">
              <div className="recommendation-icon">
                <IonIcon icon={trophyOutline} />
              </div>

              <div className="recommendation-text">
                <span>GrantAccess</span>

                <h2>Scholarship Recommendation</h2>

                <p>Find opportunities based on your profile.</p>
              </div>
            </div>

            <div
              className="recommendation-decoration recommendation-decoration-one"
              aria-hidden="true"
            />

            <div
              className="recommendation-decoration recommendation-decoration-two"
              aria-hidden="true"
            />

            <div
              className="recommendation-cap"
              aria-hidden="true"
            >
              <span />
            </div>
          </section>

          {/* STATISTICS */}

          <section
            className="student-statistics-grid"
            aria-label="Student statistics"
          >
            <button
              type="button"
              className="student-stat-card"
              onClick={openScholarships}
            >
              <span className="student-stat-icon stat-green">
                <IonIcon icon={schoolOutline} />
              </span>

              <strong>{availableScholarships}</strong>
              <span>Available</span>
              <small>Scholarships</small>
            </button>

            <button
              type="button"
              className="student-stat-card"
              onClick={openSaved}
            >
              <span className="student-stat-icon stat-blue">
                <IonIcon icon={bookmarkOutline} />
              </span>

              <strong>{savedScholarships.length}</strong>
              <span>Saved</span>
              <small>Scholarships</small>
            </button>

            <button
              type="button"
              className="student-stat-card"
              onClick={openApplications}
            >
              <span className="student-stat-icon stat-purple">
                <IonIcon icon={documentTextOutline} />
              </span>

              <strong>{applications.length}</strong>
              <span>Applications</span>
              <small>Submitted</small>
            </button>

            <button
              type="button"
              className="student-stat-card"
              onClick={openApplications}
            >
              <span className="student-stat-icon stat-yellow">
                <IonIcon icon={timeOutline} />
              </span>

              <strong>{pendingApplications}</strong>
              <span>Pending</span>
              <small>Applications</small>
            </button>
          </section>

          {/* FEATURED SCHOLARSHIPS */}

          <section className="student-featured-section">
            <div className="student-section-heading">
              <div>
                <h2>Featured Scholarships</h2>
                <p>Explore available opportunities</p>
              </div>

              <button
                type="button"
                className="student-see-all-button"
                onClick={openScholarships}
              >
                See All
                <IonIcon icon={chevronForwardOutline} />
              </button>
            </div>

            {loading ? (
              <div className="student-home-loading">
                <IonSpinner name="crescent" />
                <span>Loading scholarships...</span>
              </div>
            ) : featuredScholarships.length > 0 ? (
              <div className="student-featured-list">
                {featuredScholarships.map((scholarship) => (
                  <article
                    className="student-featured-card"
                    key={scholarship.id}
                    onClick={() =>
                      openScholarshipDetails(scholarship.id)
                    }
                  >
                    <div className="featured-organization-logo">
                      {scholarship.organizationLogo ? (
                        <img
                          src={scholarship.organizationLogo}
                          alt={`${scholarship.organizationName} logo`}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <IonIcon icon={schoolOutline} />
                      )}
                    </div>

                    <div className="featured-scholarship-details">
                      <span className="featured-organization-name">
                        {scholarship.organizationName}
                      </span>

                      <h3>{scholarship.title}</h3>

                      <strong className="featured-scholarship-amount">
                        {formatAmount(scholarship.amount)}
                      </strong>

                      <span className="featured-scholarship-deadline">
                        <IonIcon icon={calendarOutline} />
                        Deadline: {scholarship.deadline}
                      </span>
                    </div>

                    <span
                      className={`featured-status featured-status-${scholarship.applicationStatus}`}
                    >
                      {scholarship.applicationStatus}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="student-home-empty">
                <IonIcon icon={schoolOutline} />

                <h3>No scholarships available yet</h3>

                <p>
                  Published scholarship opportunities will appear
                  here once organizations post them.
                </p>

                <button
                  type="button"
                  onClick={openScholarships}
                >
                  Browse Scholarships
                </button>
              </div>
            )}
          </section>

          {/* ORGANIZATION LOCATION MAP */}

          <section className="student-organization-map-section">
            <div className="student-section-heading">
              <div>
                <div className="organization-map-title">
                  <IonIcon icon={mapOutline} />
                  <h2>Organization Locations</h2>
                </div>

                <p>
                  Find registered LGU and School organizations near you.
                </p>
              </div>

              <span className="organization-map-count">
                {organizations.length}{" "}
                {organizations.length === 1
                  ? "Organization"
                  : "Organizations"}
              </span>
            </div>

            {mapLoading ? (
              <div className="student-map-loading">
                <IonSpinner name="crescent" />
                <span>Loading organization locations...</span>
              </div>
            ) : mapError ? (
              <div className="student-map-empty">
                <IonIcon icon={locationOutline} />

                <h3>Unable to load map locations</h3>

                <p>{mapError}</p>
              </div>
            ) : organizations.length === 0 ? (
              <div className="student-map-empty">
                <IonIcon icon={locationOutline} />

                <h3>No organization pins available</h3>

                <p>
                  Registered organizations with saved map coordinates
                  will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="student-organization-map">
                  <MapContainer
                    center={mapCenter}
                    zoom={7}
                    scrollWheelZoom={false}
                    className="grantaccess-leaflet-map"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {organizations.map((organization) => (
                      <Marker
                        key={organization.id}
                        position={[
                          organization.latitude,
                          organization.longitude,
                        ]}
                        icon={organizationMarker}
                      >
                        <Popup>
                          <div className="organization-map-popup">
                            <strong>
                              {organization.organizationName}
                            </strong>

                            <span className="organization-popup-type">
                              {organization.organizationType}
                            </span>

                            <p>
                              <IonIcon icon={locationOutline} />
                              {organization.address}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                openGoogleMaps(
                                  organization.latitude,
                                  organization.longitude
                                )
                              }
                            >
                              <IonIcon icon={navigateOutline} />
                              Get Directions
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                {/* ORGANIZATION LOCATION LIST */}

                <div className="student-organization-list">
                  <div className="organization-list-heading">
                    <h3>Registered Organizations</h3>
                    <span>{organizations.length} locations</span>
                  </div>

                  {organizations.map((organization) => (
                    <article
                      className="student-organization-location-card"
                      key={organization.id}
                    >
                      <div className="organization-location-icon">
                        {organization.logo ? (
                          <img
                            src={organization.logo}
                            alt={`${organization.organizationName} logo`}
                          />
                        ) : (
                          <IonIcon icon={schoolOutline} />
                        )}
                      </div>

                      <div className="organization-location-info">
                        <strong>
                          {organization.organizationName}
                        </strong>

                        <span>
                          {organization.organizationType}
                        </span>

                        <small>
                          <IonIcon icon={locationOutline} />
                          {organization.address}
                        </small>
                      </div>

                      <button
                        type="button"
                        className="organization-directions-button"
                        aria-label={`View ${organization.organizationName} on Google Maps`}
                        onClick={() =>
                          openGoogleMaps(
                            organization.latitude,
                            organization.longitude
                          )
                        }
                      >
                        <IonIcon icon={navigateOutline} />
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* FOOTER */}

          <footer className="student-home-footer">
            <p>GrantAccess</p>
            <span>Find opportunities. Build your future.</span>
          </footer>

          <IonToast
            isOpen={Boolean(errorMessage)}
            message={errorMessage}
            duration={4000}
            color="danger"
            onDidDismiss={() => setErrorMessage("")}
          />
        </div>
      </IonContent>

      {/* BOTTOM NAVIGATION */}

      <StudentBottomNav />
    </IonPage>
  );
};

export default StudentHome;