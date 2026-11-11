import { logoutAdministrator } from '../../services/adminService';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonButton,
  IonToast,
} from '@ionic/react';

import {
  gridOutline,
  peopleOutline,
  businessOutline,
  schoolOutline,
  documentTextOutline,
  barChartOutline,
  notificationsOutline,
  timeOutline,
  settingsOutline,
  logOutOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';

import {
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../../Firebase/config';
import './AdminDashboard.css';

interface DashboardStats {
  students: number;
  organizations: number;
  scholarships: number;
  applications: number;
  pending: number;
  approved: number;
  rejected: number;
}

const initialStats: DashboardStats = {
  students: 0,
  organizations: 0,
  scholarships: 0,
  applications: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

const menuItems = [
  {
    label: 'Dashboard',
    icon: gridOutline,
    path: '/admin-dashboard',
  },
  {
    label: 'Reports & Analytics',
    icon: barChartOutline,
    path: '/admin-reports',
  },
  {
    label: 'Notifications',
    icon: notificationsOutline,
    path: '/admin-notifications',
  },
  {
    label: 'Activity Logs',
    icon: timeOutline,
    path: '/admin-activity-logs',
  },
  {
    label: 'System Settings',
    icon: settingsOutline,
    path: '/admin-settings',
  },
];

const managementCards = [
  {
    title: 'Registered Students',
    description: 'View and manage all registered student accounts.',
    icon: peopleOutline,
    path: '/admin-students',
    color: 'blue',
  },
  {
    title: 'LGU/School Accounts',
    description: 'View and manage registered LGU and school accounts.',
    icon: businessOutline,
    path: '/admin-organizations',
    color: 'purple',
  },
  {
    title: 'Scholarships',
    description: 'Review scholarship listings, availability, and deadlines.',
    icon: schoolOutline,
    path: '/admin-scholarships',
    color: 'orange',
  },
  {
    title: 'Applications',
    description: 'Monitor applications and review their current status.',
    icon: documentTextOutline,
    path: '/admin-applications',
    color: 'teal',
  },
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // LOAD STATISTICS FROM FIRESTORE
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const countCollection = async (
        collectionName: string
      ): Promise<number> => {
        const result = await getCountFromServer(
          collection(db, collectionName)
        );

        return result.data().count;
      };

      const countApplicationStatus = async (
        status: string
      ): Promise<number> => {
        const result = await getCountFromServer(
          query(
            collection(db, 'applications'),
            where('status', '==', status)
          )
        );

        return result.data().count;
      };

      const [
        students,
        organizations,
        scholarships,
        applications,
        pending,
        approved,
        rejected,
      ] = await Promise.all([
        countCollection('students'),
        countCollection('organizations'),
        countCollection('scholarships'),
        countCollection('applications'),
        countApplicationStatus('Pending'),
        countApplicationStatus('Approved'),
        countApplicationStatus('Rejected'),
      ]);

      setStats({
        students,
        organizations,
        scholarships,
        applications,
        pending,
        approved,
        rejected,
      });
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);

      setError(
        'Hindi ma-load ang dashboard data. Suriin ang Firebase configuration, collection names, at Firestore permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname !== '/admin-dashboard') return;
    let busy = false;
    let initial = true;
    const refresh = () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      const silent = !initial; initial = false;
      void loadDashboard(silent).finally(() => { busy = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [loadDashboard, pathname]);

  // NAVIGATION
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // OVERVIEW CARDS
  const statCards = [
    {
      title: 'Registered Students',
      value: stats.students,
      description: 'Total student accounts',
      icon: peopleOutline,
      color: 'blue',
    },
    {
      title: 'LGU/School Accounts',
      value: stats.organizations,
      description: 'Registered organizations',
      icon: businessOutline,
      color: 'purple',
    },
    {
      title: 'Scholarships Posted',
      value: stats.scholarships,
      description: 'Total scholarship listings',
      icon: schoolOutline,
      color: 'orange',
    },
    {
      title: 'Total Applications',
      value: stats.applications,
      description: 'Submitted applications',
      icon: documentTextOutline,
      color: 'teal',
    },
  ];

  // APPLICATION STATUS CARDS
  const applicationStatuses = [
    {
      title: 'Pending',
      value: stats.pending,
      icon: timeOutline,
      color: 'pending',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: checkmarkCircleOutline,
      color: 'approved',
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      icon: closeCircleOutline,
      color: 'rejected',
    },
  ];

  return (
    <IonPage className="admin-page">
      <div className="admin-layout">
        {/* SIDEBAR */}
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-icon"><img className="grantaccess-brand-image" src="/mylogo.png" alt="GrantAccess" />
            </div>

            <div>
              <h2>GrantAccess</h2>
              <p>Admin Portal</p>
            </div>
          </div>

          <p className="admin-menu-label">MAIN MENU</p>

          <nav className="admin-navigation">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`admin-nav-item ${
                  item.label === 'Dashboard' ? 'active' : ''
                }`}
                onClick={() => handleNavigation(item.path)}
              >
                <IonIcon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* LOGOUT */}
          <button
            type="button"
            className="admin-nav-item admin-logout"
            onClick={() => void logoutAdministrator().then(() => navigate('/admin-login', { replace: true })).catch(() => setToast('Unable to sign out. Please retry.'))}
          >
            <IonIcon icon={logOutOutline} />
            <span>Logout</span>
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="admin-main">
          <IonContent className="admin-content">
            <div className="admin-dashboard-container">
              {/* BREADCRUMB */}
              <div className="admin-breadcrumb">
                GrantAccess / Admin
              </div>

              {/* HEADER */}
              <header className="admin-page-heading">
                <div>
                  <h1>Admin Dashboard</h1>
                  <p>Welcome back, Administrator!</p>
                </div>

                <IonButton
                  fill="clear"
                  className="admin-notification-button"
                  aria-label="Open notifications"
                  onClick={() => navigate('/admin-notifications')}
                >
                  <IonIcon
                    icon={notificationsOutline}
                    slot="icon-only"
                  />
                </IonButton>
              </header>

              {/* ERROR MESSAGE */}
              {error && (
                <div className="admin-error" role="alert">
                  <IonIcon icon={alertCircleOutline} />

                  <span>{error}</span>

                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* OVERVIEW */}
              <section className="admin-section">
                <div className="admin-section-heading">
                  <div>
                    <h2>Overview</h2>
                    <p>Summary of the GrantAccess system.</p>
                  </div>

                  <span className="admin-overview-badge">
                    System Overview
                  </span>
                </div>

                <div className="admin-stats-grid">
                  {statCards.map((card) => (
                    <article
                      className={`admin-stat-card ${card.color}`}
                      key={card.title}
                    >
                      <div className="admin-stat-icon">
                        <IonIcon icon={card.icon} />
                      </div>

                      <p className="admin-stat-title">
                        {card.title}
                      </p>

                      <div className="admin-stat-value">
                        {loading ? (
                          <IonSpinner name="crescent" />
                        ) : error ? (
                          '—'
                        ) : (
                          card.value.toLocaleString()
                        )}
                      </div>

                      <p className="admin-stat-note">
                        {card.description}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              {/* APPLICATION STATUS */}
              <section className="admin-section">
                <div className="admin-section-heading">
                  <div>
                    <h2>Application Status</h2>
                    <p>
                      Overview of pending, approved, and rejected
                      applications.
                    </p>
                  </div>
                </div>

                <div className="admin-status-grid">
                  {applicationStatuses.map((item) => (
                    <article
                      className={`admin-status-card ${item.color}`}
                      key={item.title}
                    >
                      <IonIcon icon={item.icon} />

                      <div className="admin-status-info">
                        <h3>{item.title}</h3>
                        <p>Applications</p>
                      </div>

                      <strong>
                        {loading || error
                          ? '—'
                          : item.value.toLocaleString()}
                      </strong>
                    </article>
                  ))}
                </div>
              </section>

              {/* MANAGEMENT SECTION */}
              <section className="admin-management-section">
                <div className="admin-section-heading">
                  <div>
                    <h2>Management</h2>
                    <p>
                      Select a section to view and manage
                      GrantAccess records.
                    </p>
                  </div>
                </div>

                <div className="admin-management-grid">
                  {managementCards.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      className={`admin-management-card ${card.color}`}
                      onClick={() => handleNavigation(card.path)}
                      aria-label={`Open ${card.title}`}
                    >
                      <div className="admin-management-top">
                        <div className="admin-management-icon">
                          <IonIcon icon={card.icon} />
                        </div>
                      </div>

                      <h3>{card.title}</h3>

                      <p>{card.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* FOOTER */}
              <footer className="admin-footer">
                <span>
                  {loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      Loading dashboard data...
                    </>
                  ) : error ? (
                    'Dashboard data could not be loaded.'
                  ) : (
                    <>
                      <IonIcon icon={checkmarkCircleOutline} />
                      Dashboard data loaded from Firestore.
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  disabled={loading}
                >
                  <IonIcon icon={refreshOutline} />
                  Refresh data
                </button>
              </footer>
            </div>
          </IonContent>
        </main>
      </div>

      {/* TOAST */}
      <IonToast
        isOpen={Boolean(toast)}
        message={toast}
        duration={3000}
        onDidDismiss={() => setToast('')}
      />
    </IonPage>
  );
};

export default AdminDashboard;
