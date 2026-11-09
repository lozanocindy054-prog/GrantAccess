
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonToast,
  IonButton,
} from '@ionic/react';

import {
  gridOutline,
  barChartOutline,
  notificationsOutline,
  listOutline,
  settingsOutline,
  logOutOutline,
  searchOutline,
  refreshOutline,
  timeOutline,
  peopleOutline,
  shieldCheckmarkOutline,
  documentTextOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  calendarOutline,
} from 'ionicons/icons';

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../Firebase/config';
import './AdminActivityLogs.css';

interface ActivityLog {
  id: string;
  userName?: string;
  userEmail?: string;
  role?: string;
  action?: string;
  description?: string;
  status?: string;
  createdAt?: Timestamp | Date | string | null;
}

const AdminActivityLogs: React.FC = () => {
  const navigate = useNavigate();

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const activitiesQuery = query(
      collection(db, 'activityLogs'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      activitiesQuery,
      (snapshot) => {
        const records: ActivityLog[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ActivityLog[];

        setActivities(records);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading activity logs:', error);
        setLoading(false);
        setToastMessage(
          'Hindi ma-load ang activity logs. Tingnan ang Firebase configuration at Firestore rules.'
        );
        setShowToast(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const getDate = (value: ActivityLog['createdAt']): Date | null => {
    if (!value) return null;

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsedDate = new Date(value);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    return null;
  };

  const isToday = (value: ActivityLog['createdAt']) => {
    const date = getDate(value);
    if (!date) return false;

    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const getActionCategory = (activity: ActivityLog) => {
    const action = `${activity.action || ''} ${activity.description || ''}`
      .toLowerCase();

    if (
      action.includes('login') ||
      action.includes('logout') ||
      action.includes('sign in') ||
      action.includes('sign out')
    ) {
      return 'authentication';
    }

    if (
      action.includes('student') ||
      action.includes('register') ||
      action.includes('account')
    ) {
      return 'users';
    }

    if (
      action.includes('scholarship') ||
      action.includes('application')
    ) {
      return 'scholarships';
    }

    if (
      action.includes('setting') ||
      action.includes('admin') ||
      action.includes('system')
    ) {
      return 'system';
    }

    return 'other';
  };

  const getActionIcon = (activity: ActivityLog) => {
    const category = getActionCategory(activity);

    switch (category) {
      case 'authentication':
        return shieldCheckmarkOutline;
      case 'users':
        return peopleOutline;
      case 'scholarships':
        return documentTextOutline;
      case 'system':
        return settingsOutline;
      default:
        return timeOutline;
    }
  };

  const formatDate = (value: ActivityLog['createdAt']) => {
    const date = getDate(value);

    if (!date) return 'Date unavailable';

    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const filteredActivities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return activities.filter((activity) => {
      const searchableText = [
        activity.userName,
        activity.userEmail,
        activity.role,
        activity.action,
        activity.description,
        activity.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !term || searchableText.includes(term);

      const category = getActionCategory(activity);

      const matchesAction =
        actionFilter === 'all' || category === actionFilter;

      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && isToday(activity.createdAt)) ||
        (dateFilter === 'older' && !isToday(activity.createdAt));

      return matchesSearch && matchesAction && matchesDate;
    });
  }, [activities, searchTerm, actionFilter, dateFilter]);

  const todayCount = activities.filter((activity) =>
    isToday(activity.createdAt)
  ).length;

  const adminCount = activities.filter((activity) =>
    (activity.role || '').toLowerCase().includes('admin')
  ).length;

  const resetFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setDateFilter('all');
  };

  const handleRefresh = () => {
    // Firestore onSnapshot already keeps this page updated in real time.
    setToastMessage('Activity logs are updated in real time.');
    setShowToast(true);
  };

  const handleLogout = () => {
    navigate('/admin-login');
  };

  const getStatusClass = (status?: string) => {
    const normalized = (status || 'Recorded').toLowerCase();

    if (
      normalized.includes('success') ||
      normalized.includes('completed') ||
      normalized.includes('approved')
    ) {
      return 'aal-status-success';
    }

    if (
      normalized.includes('failed') ||
      normalized.includes('error') ||
      normalized.includes('denied')
    ) {
      return 'aal-status-error';
    }

    if (
      normalized.includes('pending') ||
      normalized.includes('warning')
    ) {
      return 'aal-status-pending';
    }

    return 'aal-status-recorded';
  };

  return (
    <IonPage className="aal-page">
      <IonContent fullscreen className="aal-content">
        <div className="admin-layout aal-layout">
          {/* SIDEBAR */}
          <aside className="admin-sidebar aal-sidebar">
            <div className="aal-brand">
              <div className="aal-brand-icon">
                <IonIcon icon={schoolOutlineFallback} />
              </div>

              <div className="aal-brand-text">
                <h2>GrantAccess</h2>
                <p>Admin Portal</p>
              </div>
            </div>

            <div className="aal-menu-heading">MAIN MENU</div>

            <nav className="aal-navigation">
              <button
                className="aal-nav-item"
                onClick={() => navigate('/admin-dashboard')}
              >
                <IonIcon icon={gridOutline} />
                <span>Dashboard</span>
              </button>

              <button
                className="aal-nav-item"
                onClick={() => navigate('/admin-reports')}
              >
                <IonIcon icon={barChartOutline} />
                <span>Reports &amp; Analytics</span>
              </button>

              <button
                className="aal-nav-item"
                onClick={() => navigate('/admin-notifications')}
              >
                <IonIcon icon={notificationsOutline} />
                <span>Notifications</span>
              </button>

              <button className="aal-nav-item active">
                <IonIcon icon={listOutline} />
                <span>Activity Logs</span>
              </button>

              <button
                className="aal-nav-item"
                onClick={() => navigate('/admin-settings')}
              >
                <IonIcon icon={settingsOutline} />
                <span>System Settings</span>
              </button>
            </nav>

            <div className="aal-sidebar-bottom">
              <div className="aal-admin-profile">
                <div className="aal-avatar">A</div>

                <div className="aal-profile-info">
                  <strong>Administrator</strong>
                  <span>System Admin</span>
                </div>
              </div>

              <button className="aal-logout" onClick={handleLogout}>
                <IonIcon icon={logOutOutline} />
                <span>Logout</span>
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="admin-main aal-main">
            <header className="aal-topbar">
              <div className="aal-breadcrumb">
                <span>Admin</span>
                <span className="aal-breadcrumb-divider">/</span>
                <strong>Activity Logs</strong>
              </div>

              <div className="aal-topbar-right">
                <div className="aal-topbar-icon">
                  <IonIcon icon={notificationsOutline} />
                </div>

                <div className="aal-topbar-user">
                  <div className="aal-avatar aal-avatar-small">A</div>
                  <div>
                    <strong>Administrator</strong>
                    <span>System Admin</span>
                  </div>
                </div>
              </div>
            </header>

            <section className="aal-page-content">
              <div className="aal-page-heading">
                <div>
                  <span className="aal-eyebrow">SYSTEM MONITORING</span>
                  <h1>Activity Logs</h1>
                  <p>
                    Monitor and review activities recorded across the
                    GrantAccess system.
                  </p>
                </div>

                <IonButton
                  className="aal-refresh-button"
                  onClick={handleRefresh}
                >
                  <IonIcon icon={refreshOutline} slot="start" />
                  Refresh
                </IonButton>
              </div>

              {/* SUMMARY CARDS */}
              <div className="aal-stats-grid">
                <div className="aal-stat-card">
                  <div className="aal-stat-top">
                    <span>Total Activities</span>
                    <div className="aal-stat-icon green">
                      <IonIcon icon={listOutline} />
                    </div>
                  </div>
                  <h2>{activities.length}</h2>
                  <p>All recorded activities</p>
                </div>

                <div className="aal-stat-card">
                  <div className="aal-stat-top">
                    <span>Today's Activities</span>
                    <div className="aal-stat-icon blue">
                      <IonIcon icon={calendarOutline} />
                    </div>
                  </div>
                  <h2>{todayCount}</h2>
                  <p>Activities recorded today</p>
                </div>

                <div className="aal-stat-card">
                  <div className="aal-stat-top">
                    <span>Admin Activities</span>
                    <div className="aal-stat-icon purple">
                      <IonIcon icon={shieldCheckmarkOutline} />
                    </div>
                  </div>
                  <h2>{adminCount}</h2>
                  <p>Records tagged with an admin role</p>
                </div>

                <div className="aal-stat-card">
                  <div className="aal-stat-top">
                    <span>Filtered Results</span>
                    <div className="aal-stat-icon orange">
                      <IonIcon icon={searchOutline} />
                    </div>
                  </div>
                  <h2>{filteredActivities.length}</h2>
                  <p>Activities matching your filters</p>
                </div>
              </div>

              {/* ACTIVITY TABLE */}
              <section className="aal-panel">
                <div className="aal-panel-heading">
                  <div>
                    <h2>System Activity History</h2>
                    <p>
                      Review user actions, system events, and timestamps.
                    </p>
                  </div>

                  <span className="aal-live-label">
                    <span className="aal-live-dot" />
                    Live updates
                  </span>
                </div>

                <div className="aal-filters">
                  <div className="aal-search-box">
                    <IonIcon icon={searchOutline} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                      placeholder="Search user, action, or description..."
                    />
                  </div>

                  <select
                    value={actionFilter}
                    onChange={(event) =>
                      setActionFilter(event.target.value)
                    }
                    aria-label="Filter by activity type"
                  >
                    <option value="all">All Activity Types</option>
                    <option value="authentication">Authentication</option>
                    <option value="users">Student &amp; Accounts</option>
                    <option value="scholarships">Scholarships &amp; Applications</option>
                    <option value="system">System &amp; Admin</option>
                    <option value="other">Other Activities</option>
                  </select>

                  <select
                    value={dateFilter}
                    onChange={(event) =>
                      setDateFilter(event.target.value)
                    }
                    aria-label="Filter by date"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="older">Older Activities</option>
                  </select>

                  <button
                    className="aal-reset-button"
                    onClick={resetFilters}
                  >
                    Reset
                  </button>
                </div>

                {loading ? (
                  <div className="aal-state-message">
                    <IonSpinner name="crescent" />
                    <p>Loading activity logs...</p>
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="aal-empty-state">
                    <div className="aal-empty-icon">
                      <IonIcon icon={timeOutline} />
                    </div>
                    <h3>No activity logs found</h3>
                    <p>
                      {activities.length === 0
                        ? 'Activity records will appear here once the system starts saving them to Firestore.'
                        : 'Try changing your search or filters to find activity records.'}
                    </p>
                    <button
                      className="aal-empty-reset"
                      onClick={resetFilters}
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="aal-table-wrap">
                      <table className="aal-table">
                        <thead>
                          <tr>
                            <th>USER</th>
                            <th>ACTIVITY</th>
                            <th>DATE &amp; TIME</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredActivities.map((activity) => (
                            <tr key={activity.id}>
                              <td>
                                <div className="aal-user-cell">
                                  <div className="aal-user-icon">
                                    <IonIcon
                                      icon={getActionIcon(activity)}
                                    />
                                  </div>

                                  <div className="aal-user-details">
                                    <strong>
                                      {activity.userName ||
                                        activity.userEmail ||
                                        'Unknown User'}
                                    </strong>
                                    <span>
                                      {activity.userEmail ||
                                        activity.role ||
                                        'User'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div className="aal-activity-cell">
                                  <strong>
                                    {activity.action || 'Activity recorded'}
                                  </strong>
                                  <span>
                                    {activity.description ||
                                      'No additional description'}
                                  </span>
                                </div>
                              </td>

                              <td>
                                <div className="aal-date-cell">
                                  <strong>
                                    {formatDate(activity.createdAt)}
                                  </strong>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={`aal-status ${getStatusClass(
                                    activity.status
                                  )}`}
                                >
                                  {activity.status || 'Recorded'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="aal-table-footer">
                      <span>
                        Showing <strong>{filteredActivities.length}</strong>{' '}
                        of <strong>{activities.length}</strong> activities
                      </span>
                      <span className="aal-footer-note">
                        <IonIcon icon={checkmarkCircleOutline} />
                        Synced with Firestore
                      </span>
                    </div>
                  </>
                )}
              </section>

              <div className="aal-information">
                <IonIcon icon={alertCircleOutline} />
                <p>
                  Activity records depend on the events saved by your
                  application. This page displays existing records; it does
                  not automatically create logs for actions performed on
                  other pages.
                </p>
              </div>

              <footer className="aal-footer">
                <span>© {new Date().getFullYear()} GrantAccess Admin Portal</span>
                <span>Activity Monitoring</span>
              </footer>
            </section>
          </main>
        </div>

        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3000}
          position="top"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

const schoolOutlineFallback = document ? document.createElement('span') as any : undefined;

export default AdminActivityLogs;
