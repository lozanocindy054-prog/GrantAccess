
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonToast,
  IonModal,
} from '@ionic/react';

import {
  businessOutline,
  schoolOutline,
  documentTextOutline,
  notificationsOutline,
  settingsOutline,
  personCircleOutline,
  logOutOutline,
  chevronDownOutline,
  peopleOutline,
  checkmarkCircleOutline,
  timeOutline,
  shieldCheckmarkOutline,
  locationOutline,
  mapOutline,
  home,
  closeOutline,
} from 'ionicons/icons';

import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
} from 'firebase/firestore';

import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';

import { auth, db } from '../../Firebase/config';

import ManageScholarships from '../ManageScholarships/ManageScholarships';
import LGUSchoolProfile from '../LGUSchoolProfile/LGUSchoolProfile';
import Applications from '../Applications/Applications';

import './LGUSchoolDashboard.css';

// ==========================================
// INTERFACES
// ==========================================

interface Scholarship {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
}

interface Application {
  id: string;
  status: string;
  studentName: string;
  scholarshipTitle: string;
}

interface OrganizationProfileData {
  organizationName: string;
  logoUrl: string;
}

interface MainMenuItem {
  label: string;
  description: string;
  path: string;
  icon: typeof businessOutline;
  color: string;
}

// ==========================================
// ROUTE PATHS
// ==========================================

const LOGIN_PATH = '/lgu-login';
const HOME_PATH = '/lgu-dashboard';
const ORGANIZATION_PROFILE_PATH = '/lgu-organization-profile';
const SCHOLARSHIPS_PATH = '/lgu-scholarships';
const APPLICATIONS_PATH = '/lgu-applications';
const STUDENT_MAP_PATH = '/lgu-student-map';
const ORGANIZATION_MAP_PIN_PATH = '/lgu-organization-map-pin';

// ==========================================
// MAIN MENU
// ==========================================

const mainMenuItems: MainMenuItem[] = [
  {
    label: 'Home',
    description: 'View your organization dashboard overview.',
    path: HOME_PATH,
    icon: home,
    color: 'green',
  },
  {
    label: 'My Organization',
    description: 'View and manage your organization information.',
    path: ORGANIZATION_PROFILE_PATH,
    icon: businessOutline,
    color: 'green',
  },
  {
    label: 'Set Map Pin',
    description: 'Pin your organization location for students to see.',
    path: ORGANIZATION_MAP_PIN_PATH,
    icon: mapOutline,
    color: 'blue',
  },
  {
    label: 'Manage Scholarships',
    description: 'Create, update, and manage scholarship listings.',
    path: SCHOLARSHIPS_PATH,
    icon: schoolOutline,
    color: 'blue',
  },
  {
    label: 'Applications',
    description: 'Review and manage student applications.',
    path: APPLICATIONS_PATH,
    icon: peopleOutline,
    color: 'purple',
  },
  {
    label: 'Student Map',
    description: 'View approximate locations shared by your applicants.',
    path: STUDENT_MAP_PATH,
    icon: locationOutline,
    color: 'blue',
  },
];

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================

const LGUSchoolDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // ORGANIZATION PROFILE
  // Same Firestore document used by LGUSchoolProfile.

  const [organizationProfile, setOrganizationProfile] =
    useState<OrganizationProfileData>({
      organizationName: 'Organization',
      logoUrl: '',
    });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // MODAL STATES

  const [showManageScholarships, setShowManageScholarships] =
    useState(false);

  const [showOrganizationProfile, setShowOrganizationProfile] =
    useState(false);

  const [openOrganizationMapPin, setOpenOrganizationMapPin] =
    useState(false);

  const [showApplications, setShowApplications] = useState(false);

  // FIRESTORE DATA

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  const [loadingScholarships, setLoadingScholarships] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(true);

  const [toast, setToast] = useState({
    isOpen: false,
    message: '',
    color: 'success' as 'success' | 'danger' | 'warning',
  });

  // ==========================================
  // TOAST
  // ==========================================

  const showMessage = useCallback(
    (
      message: string,
      color: 'success' | 'danger' | 'warning' = 'success'
    ) => {
      setToast({
        isOpen: true,
        message,
        color,
      });
    },
    []
  );

  // ==========================================
  // CLOSE ALL MODALS
  // ==========================================

  const closeAllModals = useCallback(() => {
    setShowManageScholarships(false);
    setShowOrganizationProfile(false);
    setShowApplications(false);
  }, []);

  // ==========================================
  // MODAL FUNCTIONS
  // ==========================================

  const openManageScholarships = useCallback(() => {
    closeAllModals();
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowManageScholarships(true);
  }, [closeAllModals]);

  const closeManageScholarships = useCallback(() => {
    setShowManageScholarships(false);
  }, []);

  const openOrganizationProfile = useCallback(() => {
    closeAllModals();
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowOrganizationProfile(true);
  }, [closeAllModals]);

  const closeOrganizationProfile = useCallback(() => {
    setShowOrganizationProfile(false);
  }, []);

  const openApplications = useCallback(() => {
    closeAllModals();
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowApplications(true);
  }, [closeAllModals]);

  const closeApplications = useCallback(() => {
    setShowApplications(false);
  }, []);

  // ==========================================
  // NAVIGATION
  // ==========================================

  const handleNavigation = useCallback(
    (path: string) => {
      setShowProfileMenu(false);
      setShowNotifications(false);

      if (path === ORGANIZATION_PROFILE_PATH) {
        setOpenOrganizationMapPin(false);
        openOrganizationProfile();
        return;
      }

      if (path === ORGANIZATION_MAP_PIN_PATH) {
        setOpenOrganizationMapPin(true);
        openOrganizationProfile();
        return;
      }

      if (path === SCHOLARSHIPS_PATH) {
        openManageScholarships();
        return;
      }

      if (path === APPLICATIONS_PATH) {
        openApplications();
        return;
      }

      if (path && location.pathname !== path) {
        closeAllModals();
        navigate(path);
      }
    },
    [
      navigate,
      location.pathname,
      openManageScholarships,
      openOrganizationProfile,
      openApplications,
      closeAllModals,
    ]
  );

  // ==========================================
  // FIREBASE AUTH + LIVE DATA
  // ==========================================

  useEffect(() => {
    let active = true;

    let unsubscribeScholarships: (() => void) | undefined;
    let unsubscribeApplications: (() => void) | undefined;

    const stopListeners = () => {
      unsubscribeScholarships?.();
      unsubscribeApplications?.();

      unsubscribeScholarships = undefined;
      unsubscribeApplications = undefined;
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        stopListeners();

        if (!active) return;

        setCurrentUser(user);
        setScholarships([]);
        setApplications([]);

        setLoadingScholarships(Boolean(user));
        setLoadingApplications(Boolean(user));

        if (!user) {
          setLoadingScholarships(false);
          setLoadingApplications(false);

          setOrganizationProfile({
            organizationName: 'Organization',
            logoUrl: '',
          });

          closeAllModals();
          navigate(LOGIN_PATH, { replace: true });
          return;
        }

        // SCHOLARSHIPS LISTENER

        const scholarshipQuery = query(
          collection(db, 'scholarships'),
          where('organizationId', '==', user.uid)
        );

        unsubscribeScholarships = onSnapshot(
          scholarshipQuery,
          (snapshot) => {
            if (!active) return;

            const data: Scholarship[] = snapshot.docs.map((document) => {
              const item = document.data();

              return {
                id: document.id,
                title: String(
                  item.title ?? item.name ?? 'Untitled Scholarship'
                ),
                category: String(item.category ?? item.type ?? 'Other'),
                description: String(item.description ?? ''),
                status: String(item.status ?? 'Pending'),
              };
            });

            setScholarships(data);
            setLoadingScholarships(false);
          },
          (error) => {
            console.error('Scholarship loading error:', error);

            if (!active) return;

            setLoadingScholarships(false);

            showMessage(
              'Unable to load scholarships. Check your Firestore Rules and organizationId.',
              'danger'
            );
          }
        );

        // APPLICATIONS LISTENER

        const applicationQuery = query(
          collection(db, 'applications'),
          where('organizationId', '==', user.uid)
        );

        unsubscribeApplications = onSnapshot(
          applicationQuery,
          (snapshot) => {
            if (!active) return;

            const data: Application[] = snapshot.docs.map((document) => {
              const item = document.data();

              return {
                id: document.id,
                status: String(item.status ?? 'Pending'),
                studentName: String(
                  item.studentName ?? item.fullName ?? 'Student'
                ),
                scholarshipTitle: String(
                  item.scholarshipTitle ??
                    item.scholarshipName ??
                    'Scholarship'
                ),
              };
            });

            setApplications(data);
            setLoadingApplications(false);
          },
          (error) => {
            console.error('Application loading error:', error);

            if (!active) return;

            setLoadingApplications(false);

            showMessage(
              'Unable to load applications. Check the organizationId field and Firestore Rules.',
              'warning'
            );
          }
        );
      },
      (error) => {
        console.error('Authentication listener error:', error);

        if (active) {
          showMessage(
            'Unable to verify your account. Please log in again.',
            'danger'
          );
        }
      }
    );

    return () => {
      active = false;
      unsubscribeAuth();
      stopListeners();
    };
  }, [navigate, showMessage, closeAllModals]);

  // ==========================================
  // ORGANIZATION PROFILE LIVE LISTENER
  // ==========================================
  // IMPORTANT:
  // LGUSchoolProfile and this Dashboard both use:
  // organizations/{currentUser.uid}
  //
  // Expected fields:
  // organizationName
  // logoUrl
  //
  // When the logo is changed in LGUSchoolProfile,
  // onSnapshot automatically updates this dashboard.

  useEffect(() => {
    if (!currentUser?.uid) {
      setOrganizationProfile({
        organizationName: 'Organization',
        logoUrl: '',
      });

      return;
    }

    const organizationRef = doc(
      db,
      'organizations',
      currentUser.uid
    );

    const unsubscribeOrganization = onSnapshot(
      organizationRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn(
            'Organization document not found:',
            currentUser.uid
          );

          setOrganizationProfile({
            organizationName: 'Organization',
            logoUrl: '',
          });

          return;
        }

        const data = snapshot.data();

        setOrganizationProfile({
          organizationName: String(
            data.organizationName ??
              data.name ??
              data.orgName ??
              'Organization'
          ),

          logoUrl: String(
            data.logoUrl ??
              data.logoURL ??
              data.organizationLogo ??
              data.logo ??
              ''
          ),
        });
      },
      (error) => {
        console.error('Organization profile loading error:', error);

        showMessage(
          'Unable to load organization profile. Please check Firestore Rules.',
          'warning'
        );
      }
    );

    return () => {
      unsubscribeOrganization();
    };
  }, [currentUser, showMessage]);

  // ==========================================
  // DASHBOARD STATISTICS
  // ==========================================

  const publishedCount = scholarships.filter(
    (item) => item.status.toLowerCase() === 'published'
  ).length;

  const pendingCount = applications.filter(
    (item) => item.status.toLowerCase() === 'pending'
  ).length;

  const approvedCount = applications.filter(
    (item) => item.status.toLowerCase() === 'approved'
  ).length;

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      setShowProfileMenu(false);
      setShowNotifications(false);
      closeAllModals();

      await signOut(auth);

      setCurrentUser(null);
      setScholarships([]);
      setApplications([]);

      setOrganizationProfile({
        organizationName: 'Organization',
        logoUrl: '',
      });

      navigate(LOGIN_PATH, { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      showMessage('Unable to log out. Please try again.', 'danger');
    }
  };

  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <IonPage>
      <IonContent fullscreen className="lgu-dashboard-content">
        <div className="lgu-home-layout">

          {/* TOP NAVIGATION */}

          <header className="lgu-home-topbar">
            <div className="lgu-home-brand">
              <div className="lgu-home-brand-icon">
                <IonIcon icon={schoolOutline} />
              </div>

              <div>
                <h1>GrantAccess</h1>
                <p>Access. Apply. Build Your Future.</p>
              </div>
            </div>

            <div className="lgu-home-topbar-right">

              {/* NOTIFICATIONS */}

              <button
                type="button"
                className="lgu-home-icon-button"
                onClick={() => {
                  setShowNotifications((previous) => !previous);
                  setShowProfileMenu(false);
                }}
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <IonIcon icon={notificationsOutline} />

                {applications.length > 0 && (
                  <span className="lgu-home-notification-dot" />
                )}
              </button>

              {showNotifications && (
                <div className="lgu-home-notification-dropdown">
                  <strong>Dashboard Overview</strong>

                  <div>
                    <IonIcon icon={schoolOutline} />
                    <span>{scholarships.length} scholarship listings</span>
                  </div>

                  <div>
                    <IonIcon icon={documentTextOutline} />
                    <span>{applications.length} applications received</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavigation('/lgu-notifications')}
                  >
                    Open Notifications
                  </button>
                </div>
              )}

              {/* ORGANIZATION PROFILE */}

              <div className="lgu-home-profile-wrapper">
                <button
                  type="button"
                  className="lgu-home-profile-button"
                  onClick={() => {
                    setShowProfileMenu((previous) => !previous);
                    setShowNotifications(false);
                  }}
                  aria-expanded={showProfileMenu}
                >
                  <span className="lgu-home-profile-avatar">
                    {organizationProfile.logoUrl ? (
                      <img
                        src={organizationProfile.logoUrl}
                        alt={`${organizationProfile.organizationName} Logo`}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <IonIcon icon={personCircleOutline} />
                    )}
                  </span>

                  <span className="lgu-home-profile-info">
                    <strong>
                      {organizationProfile.organizationName}
                    </strong>
                    <small>Organization Account</small>
                    <small>
                      {currentUser?.email ?? 'LGU / School'}
                    </small>
                  </span>

                  <IonIcon icon={chevronDownOutline} />
                </button>

                {showProfileMenu && (
                  <div className="lgu-home-profile-dropdown">
                    <button
                      type="button"
                      onClick={() =>
                        handleNavigation(ORGANIZATION_PROFILE_PATH)
                      }
                    >
                      <IonIcon icon={businessOutline} />
                      My Organization
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavigation('/lgu-settings')}
                    >
                      <IonIcon icon={settingsOutline} />
                      Settings
                    </button>

                    <button type="button" onClick={handleLogout}>
                      <IonIcon icon={logOutOutline} />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* DASHBOARD CONTENT */}

          <main className="lgu-home-content">

            {/* WELCOME BANNER */}

            <section className="lgu-home-welcome">
              <div className="lgu-home-welcome-copy">
                <span className="lgu-home-eyebrow">
                  <IonIcon icon={home} />
                  ORGANIZATION HOME
                </span>

                <h2>Welcome Back, Organization Admin!</h2>

                <p>
                  Manage your scholarship opportunities, review student
                  applications, and monitor your organization's activities
                  in one place.
                </p>
              </div>

              <div className="lgu-home-welcome-art">
                <div className="lgu-home-art-circle" />

                <div className="lgu-home-art-card">
                  <IonIcon icon={schoolOutline} />
                  <strong>Scholarship Opportunities</strong>
                  <span>Empowering students through education.</span>
                </div>
              </div>
            </section>

            {/* MAIN MENU */}

            <section className="lgu-home-menu-section">
              <div className="lgu-home-section-heading">
                <div>
                  <h2>Main Menu</h2>
                  <p>Explore and manage your organization portal.</p>
                </div>
              </div>

              <div className="lgu-home-menu-panel">
                <div className="lgu-home-menu-grid">
                  {mainMenuItems.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path === SCHOLARSHIPS_PATH &&
                        showManageScholarships) ||
                      (item.path === ORGANIZATION_PROFILE_PATH &&
                        showOrganizationProfile) ||
                      (item.path === ORGANIZATION_MAP_PIN_PATH &&
                        showOrganizationProfile &&
                        openOrganizationMapPin) ||
                      (item.path === APPLICATIONS_PATH &&
                        showApplications);

                    return (
                      <div
                        className={`lgu-home-menu-item ${
                          isActive ? 'active' : ''
                        }`}
                        key={item.path}
                      >
                        <button
                          type="button"
                          className={`lgu-home-menu-icon-button ${item.color}`}
                          onClick={() => handleNavigation(item.path)}
                          aria-label={`Open ${item.label}`}
                          title={item.label}
                        >
                          <IonIcon icon={item.icon} />
                        </button>

                        <div className="lgu-home-menu-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </div>

                        {item.path === SCHOLARSHIPS_PATH && (
                          <span className="lgu-home-menu-count">
                            {loadingScholarships
                              ? '...'
                              : scholarships.length}
                          </span>
                        )}

                        {item.path === APPLICATIONS_PATH && (
                          <span className="lgu-home-menu-count">
                            {loadingApplications
                              ? '...'
                              : applications.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* DASHBOARD OVERVIEW */}

            <section className="lgu-home-statistics-section">
              <div className="lgu-home-section-heading">
                <div>
                  <h2>Dashboard Overview</h2>
                  <p>Monitor your organization's performance.</p>
                </div>

                <span className="lgu-home-live">
                  <span />
                  Live Data
                </span>
              </div>

              <div className="lgu-home-stats-grid">
                <article className="lgu-home-stat-card">
                  <div className="lgu-home-stat-top">
                    <span className="lgu-home-stat-icon green">
                      <IonIcon icon={schoolOutline} />
                    </span>
                    <span className="lgu-home-stat-label">LISTINGS</span>
                  </div>

                  <p>Total Scholarships</p>

                  <strong className="lgu-home-stat-value">
                    {loadingScholarships ? (
                      <IonSpinner name="crescent" />
                    ) : scholarships.length}
                  </strong>

                  <small>Total scholarships managed</small>
                </article>

                <article className="lgu-home-stat-card">
                  <div className="lgu-home-stat-top">
                    <span className="lgu-home-stat-icon blue">
                      <IonIcon icon={checkmarkCircleOutline} />
                    </span>
                    <span className="lgu-home-stat-label">ACTIVE</span>
                  </div>

                  <p>Published Scholarships</p>

                  <strong className="lgu-home-stat-value">
                    {loadingScholarships ? (
                      <IonSpinner name="crescent" />
                    ) : publishedCount}
                  </strong>

                  <small>Currently published opportunities</small>
                </article>

                <article className="lgu-home-stat-card">
                  <div className="lgu-home-stat-top">
                    <span className="lgu-home-stat-icon purple">
                      <IonIcon icon={peopleOutline} />
                    </span>
                    <span className="lgu-home-stat-label">APPLICANTS</span>
                  </div>

                  <p>Total Applications</p>

                  <strong className="lgu-home-stat-value">
                    {loadingApplications ? (
                      <IonSpinner name="crescent" />
                    ) : applications.length}
                  </strong>

                  <small>Applications received</small>
                </article>

                <article className="lgu-home-stat-card">
                  <div className="lgu-home-stat-top">
                    <span className="lgu-home-stat-icon orange">
                      <IonIcon icon={timeOutline} />
                    </span>
                    <span className="lgu-home-stat-label">FOR REVIEW</span>
                  </div>

                  <p>Pending Applications</p>

                  <strong className="lgu-home-stat-value">
                    {loadingApplications ? (
                      <IonSpinner name="crescent" />
                    ) : pendingCount}
                  </strong>

                  <small>Applications waiting for review</small>
                </article>
              </div>
            </section>

            {/* APPLICATION SUMMARY */}

            <section className="lgu-home-application-section">
              <div className="lgu-home-section-heading">
                <div>
                  <h2>Application Summary</h2>
                  <p>Check the current status of student applications.</p>
                </div>

                <button
                  type="button"
                  className="lgu-home-view-all"
                  onClick={openApplications}
                >
                  View Applications
                </button>
              </div>

              <div className="lgu-home-application-grid">
                <div className="lgu-home-application-card">
                  <span className="pending">
                    <IonIcon icon={timeOutline} />
                  </span>
                  <div>
                    <strong>
                      {loadingApplications ? '...' : pendingCount}
                    </strong>
                    <small>Pending Review</small>
                  </div>
                </div>

                <div className="lgu-home-application-card">
                  <span className="approved">
                    <IonIcon icon={checkmarkCircleOutline} />
                  </span>
                  <div>
                    <strong>
                      {loadingApplications ? '...' : approvedCount}
                    </strong>
                    <small>Approved Applications</small>
                  </div>
                </div>

                <div className="lgu-home-application-card">
                  <span className="total">
                    <IonIcon icon={documentTextOutline} />
                  </span>
                  <div>
                    <strong>
                      {loadingApplications ? '...' : applications.length}
                    </strong>
                    <small>Total Applications</small>
                  </div>
                </div>
              </div>
            </section>

            {/* RECENT SCHOLARSHIPS */}

            <section className="lgu-home-recent-section">
              <div className="lgu-home-section-heading">
                <div>
                  <h2>Recent Scholarships</h2>
                  <p>Your latest scholarship listings.</p>
                </div>

                <button
                  type="button"
                  className="lgu-home-view-all"
                  onClick={openManageScholarships}
                >
                  View All
                </button>
              </div>

              <div className="lgu-home-recent-card">
                {loadingScholarships ? (
                  <div className="lgu-home-loading">
                    <IonSpinner name="crescent" />
                    <span>Loading scholarship listings...</span>
                  </div>
                ) : scholarships.length === 0 ? (
                  <div className="lgu-home-empty">
                    <span>
                      <IonIcon icon={schoolOutline} />
                    </span>

                    <strong>No scholarships yet</strong>

                    <p>
                      You haven't posted any scholarship opportunities.
                      Start by creating your first scholarship listing.
                    </p>

                    <button
                      type="button"
                      onClick={openManageScholarships}
                    >
                      Manage Scholarships
                    </button>
                  </div>
                ) : (
                  <div className="lgu-home-scholarship-list">
                    {scholarships.slice(0, 5).map((item) => (
                      <div
                        className="lgu-home-scholarship-row"
                        key={item.id}
                      >
                        <div className="lgu-home-scholarship-icon">
                          <IonIcon icon={documentTextOutline} />
                        </div>

                        <div className="lgu-home-scholarship-info">
                          <strong>{item.title}</strong>
                          <span>
                            {item.category}
                            {item.description
                              ? ` • ${item.description}`
                              : ''}
                          </span>
                        </div>

                        <span
                          className={`lgu-home-status ${
                            item.status.toLowerCase() === 'published'
                              ? 'published'
                              : item.status.toLowerCase() === 'rejected'
                                ? 'rejected'
                                : 'pending'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* FOOTER */}

            <footer className="lgu-home-footer">
              <span>
                © {new Date().getFullYear()} GrantAccess. All rights reserved.
              </span>

              <span>
                <IonIcon icon={shieldCheckmarkOutline} />
                LGU / School Portal
              </span>
            </footer>
          </main>
        </div>

        {/* TOAST */}

        <IonToast
          isOpen={toast.isOpen}
          message={toast.message}
          color={toast.color}
          duration={3500}
          position="top"
          onDidDismiss={() =>
            setToast((previous) => ({
              ...previous,
              isOpen: false,
            }))
          }
        />
      </IonContent>

      {/* MANAGE SCHOLARSHIPS MODAL */}

      <IonModal
        isOpen={showManageScholarships}
        onDidDismiss={closeManageScholarships}
        className="lgu-scholarship-popout"
        backdropDismiss={true}
      >
        <div className="lgu-scholarship-modal-wrapper">
          <button
            type="button"
            className="lgu-scholarship-modal-close"
            onClick={closeManageScholarships}
            aria-label="Close Manage Scholarships"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <ManageScholarships />
        </div>
      </IonModal>

      {/* MY ORGANIZATION MODAL */}

      <IonModal
        isOpen={showOrganizationProfile}
        onDidDismiss={closeOrganizationProfile}
        className="lgu-organization-popout"
        backdropDismiss={true}
      >
        <div className="lgu-organization-modal-wrapper">
          <button
            type="button"
            className="lgu-organization-modal-close"
            onClick={closeOrganizationProfile}
            aria-label="Close My Organization"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <LGUSchoolProfile
            openLocationEditor={openOrganizationMapPin}
            onLocationEditorOpened={() =>
              setOpenOrganizationMapPin(false)
            }
          />
        </div>
      </IonModal>

      {/* APPLICATIONS MODAL */}

      <IonModal
        isOpen={showApplications}
        onDidDismiss={closeApplications}
        className="lgu-applications-popout"
        backdropDismiss={true}
      >
        <div className="lgu-applications-modal-wrapper">
          <button
            type="button"
            className="lgu-applications-modal-close"
            onClick={closeApplications}
            aria-label="Close Applications"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <Applications />
        </div>
      </IonModal>
    </IonPage>
  );
};

export default LGUSchoolDashboard;
