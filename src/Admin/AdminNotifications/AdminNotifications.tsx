import { logoutAdministrator } from '../../services/adminService';
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
  schoolOutline,
  barChartOutline,
  notificationsOutline,
  timeOutline,
  settingsOutline,
  logOutOutline,
  searchOutline,
  mailUnreadOutline,
  mailOpenOutline,
  checkmarkDoneOutline,
  peopleOutline,
  documentTextOutline,
  alertCircleOutline,
  refreshOutline,
} from 'ionicons/icons';

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../Firebase/config';
import './AdminNotifications.css';

type NotificationType =
  | 'student_registration'
  | 'application'
  | 'scholarship'
  | 'system'
  | string;

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt?: Timestamp | Date | null;
}

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

const AdminNotifications: React.FC = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [readFilter, setReadFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationData: AdminNotification[] = snapshot.docs.map(
          (notificationDoc) => {
            const data = notificationDoc.data();

            return {
              id: notificationDoc.id,
              title: data.title || 'Notification',
              message: data.message || data.description || '',
              type: data.type || 'system',
              isRead: data.isRead === true,
              createdAt: data.createdAt || null,
            };
          }
        );

        setNotifications(notificationData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading notifications:', error);
        setLoading(false);
        setToastMessage(
          'Hindi ma-load ang notifications. Tingnan ang Firebase connection at permissions.'
        );
        setShowToast(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const totalNotifications = notifications.length;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const readNotifications = notifications.filter(
    (notification) => notification.isRead
  ).length;

  const filteredNotifications = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesSearch =
        notification.title.toLowerCase().includes(search) ||
        notification.message.toLowerCase().includes(search);

      const matchesReadFilter =
        readFilter === 'all' ||
        (readFilter === 'unread' && !notification.isRead) ||
        (readFilter === 'read' && notification.isRead);

      const matchesType =
        typeFilter === 'all' || notification.type === typeFilter;

      return matchesSearch && matchesReadFilter && matchesType;
    });
  }, [notifications, searchTerm, readFilter, typeFilter]);

  const formatDate = (
    createdAt: AdminNotification['createdAt']
  ): string => {
    if (!createdAt) return 'Date unavailable';

    const date =
      createdAt instanceof Timestamp
        ? createdAt.toDate()
        : createdAt instanceof Date
          ? createdAt
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getNotificationType = (type: string) => {
    switch (type) {
      case 'student_registration':
        return {
          label: 'Student Registration',
          className: 'student-type',
          icon: peopleOutline,
        };

      case 'application':
        return {
          label: 'Scholarship Application',
          className: 'application-type',
          icon: documentTextOutline,
        };

      case 'scholarship':
        return {
          label: 'Scholarship Posting',
          className: 'scholarship-type',
          icon: schoolOutline,
        };

      default:
        return {
          label: 'System Update',
          className: 'system-type',
          icon: alertCircleOutline,
        };
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
      });

      setToastMessage('Notification marked as read.');
      setShowToast(true);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setToastMessage('Hindi ma-update ang notification. Subukan ulit.');
      setShowToast(true);
    }
  };

  const markAllAsRead = async () => {
    const unreadItems = notifications.filter(
      (notification) => !notification.isRead
    );

    if (unreadItems.length === 0) {
      setToastMessage('Wala nang unread notifications.');
      setShowToast(true);
      return;
    }

    try {
      setProcessing(true);

      for (let start = 0; start < unreadItems.length; start += 500) {
        const batch = writeBatch(db);
        const currentBatch = unreadItems.slice(start, start + 500);

        currentBatch.forEach((notification) => {
          batch.update(doc(db, 'notifications', notification.id), {
            isRead: true,
          });
        });

        await batch.commit();
      }

      setToastMessage('All notifications marked as read.');
      setShowToast(true);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setToastMessage('Hindi ma-update ang lahat. Subukan ulit.');
      setShowToast(true);
    } finally {
      setProcessing(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setReadFilter('all');
    setTypeFilter('all');
  };

  const handleLogout = async () => {
    try { await logoutAdministrator(); navigate('/admin-login', { replace: true }); }
    catch { setToastMessage('Unable to sign out. Please retry.'); setShowToast(true); }
  };

  return (
    <IonPage className="admin-page">
      <div className="admin-layout">
        {/* SIDEBAR — SAME STRUCTURE AS ADMIN DASHBOARD */}
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
                  item.label === 'Notifications' ? 'active' : ''
                }`}
                onClick={() => navigate(item.path)}
              >
                <IonIcon icon={item.icon} />
                <span>{item.label}</span>

                {item.label === 'Notifications' &&
                  unreadNotifications > 0 && (
                    <span className="admin-nav-badge">
                      {unreadNotifications > 99
                        ? '99+'
                        : unreadNotifications}
                    </span>
                  )}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="admin-nav-item admin-logout"
            onClick={handleLogout}
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
                GrantAccess / Admin / Notifications
              </div>

              {/* PAGE HEADER */}
              <header className="admin-page-heading">
                <div>
                  <h1>Notifications</h1>
                  <p>Stay updated with activities across GrantAccess.</p>
                </div>

                <IonButton
                  fill="clear"
                  className="admin-notification-button"
                  aria-label="Notifications"
                >
                  <IonIcon
                    icon={notificationsOutline}
                    slot="icon-only"
                  />
                </IonButton>
              </header>

              {/* OVERVIEW */}
              <section className="admin-section">
                <div className="admin-section-heading">
                  <div>
                    <h2>Notification Overview</h2>
                    <p>Monitor your latest system notifications.</p>
                  </div>

                  <button
                    type="button"
                    className="admin-reset-button"
                    onClick={resetFilters}
                  >
                    <IonIcon icon={refreshOutline} />
                    Reset Filters
                  </button>
                </div>

                <div className="admin-notification-stats-grid">
                  <article className="admin-notification-stat-card total">
                    <div className="admin-stat-icon">
                      <IonIcon icon={notificationsOutline} />
                    </div>

                    <p className="admin-stat-title">Total Notifications</p>

                    <div className="admin-stat-value">
                      {loading ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        totalNotifications.toLocaleString()
                      )}
                    </div>

                    <p className="admin-stat-note">
                      All received notifications
                    </p>
                  </article>

                  <article className="admin-notification-stat-card unread">
                    <div className="admin-stat-icon">
                      <IonIcon icon={mailUnreadOutline} />
                    </div>

                    <p className="admin-stat-title">Unread Notifications</p>

                    <div className="admin-stat-value">
                      {loading ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        unreadNotifications.toLocaleString()
                      )}
                    </div>

                    <p className="admin-stat-note">
                      Need your attention
                    </p>
                  </article>

                  <article className="admin-notification-stat-card read">
                    <div className="admin-stat-icon">
                      <IonIcon icon={mailOpenOutline} />
                    </div>

                    <p className="admin-stat-title">Read Notifications</p>

                    <div className="admin-stat-value">
                      {loading ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        readNotifications.toLocaleString()
                      )}
                    </div>

                    <p className="admin-stat-note">
                      Already reviewed
                    </p>
                  </article>
                </div>
              </section>

              {/* NOTIFICATION LIST */}
              <section className="admin-notification-panel">
                <div className="admin-notification-panel-heading">
                  <div>
                    <h2>All Notifications</h2>
                    <p>
                      View and manage student, scholarship, and system updates.
                    </p>
                  </div>

                  <IonButton
                    className="admin-mark-all-button"
                    onClick={markAllAsRead}
                    disabled={processing || unreadNotifications === 0}
                  >
                    {processing ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={checkmarkDoneOutline} slot="start" />
                    )}
                    Mark All as Read
                  </IonButton>
                </div>

                {/* SEARCH AND FILTERS */}
                <div className="admin-notification-filters">
                  <label className="admin-notification-search">
                    <IonIcon icon={searchOutline} />
                    <input
                      type="text"
                      placeholder="Search notifications..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      aria-label="Search notifications"
                    />
                  </label>

                  <select
                    className="admin-notification-select"
                    value={readFilter}
                    onChange={(event) => setReadFilter(event.target.value)}
                    aria-label="Filter by read status"
                  >
                    <option value="all">All Notifications</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>

                  <select
                    className="admin-notification-select"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    aria-label="Filter by notification type"
                  >
                    <option value="all">All Types</option>
                    <option value="student_registration">
                      Student Registration
                    </option>
                    <option value="application">
                      Scholarship Application
                    </option>
                    <option value="scholarship">Scholarship Posting</option>
                    <option value="system">System Update</option>
                  </select>
                </div>

                {/* RESULT SUMMARY */}
                <div className="admin-notification-list-summary">
                  <span>
                    Showing <strong>{filteredNotifications.length}</strong> of{' '}
                    <strong>{totalNotifications}</strong> notifications
                  </span>

                  <span className="admin-live-status">
                    <span />
                    Live updates
                  </span>
                </div>

                {/* LOADING / EMPTY / NOTIFICATION LIST */}
                {loading ? (
                  <div className="admin-notification-loading">
                    <IonSpinner name="crescent" />
                    <p>Loading notifications...</p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="admin-notification-empty">
                    <div className="admin-notification-empty-icon">
                      <IonIcon icon={notificationsOutline} />
                    </div>

                    <h3>No notifications found</h3>

                    <p>
                      {totalNotifications === 0
                        ? 'Wala pang notification sa Firebase. Lalabas dito ang notifications kapag may na-save na.'
                        : 'Try changing your search keyword or filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="admin-notification-list">
                    {filteredNotifications.map((notification) => {
                      const typeInfo = getNotificationType(notification.type);

                      return (
                        <article
                          className={`admin-notification-item ${
                            !notification.isRead ? 'unread' : ''
                          }`}
                          key={notification.id}
                        >
                          <div
                            className={`admin-notification-type-icon ${typeInfo.className}`}
                          >
                            <IonIcon icon={typeInfo.icon} />
                          </div>

                          <div className="admin-notification-details">
                            <div className="admin-notification-title-row">
                              <h3>{notification.title}</h3>

                              {!notification.isRead && (
                                <span className="admin-unread-pill">
                                  New
                                </span>
                              )}
                            </div>

                            <p className="admin-notification-message">
                              {notification.message ||
                                'There are updates available in GrantAccess.'}
                            </p>

                            <div className="admin-notification-meta">
                              <span
                                className={`admin-notification-type-label ${typeInfo.className}`}
                              >
                                <IonIcon icon={typeInfo.icon} />
                                {typeInfo.label}
                              </span>

                              <span className="admin-notification-date">
                                <IonIcon icon={timeOutline} />
                                {formatDate(notification.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="admin-notification-actions">
                            {notification.isRead ? (
                              <span className="admin-read-status">
                                <IonIcon icon={mailOpenOutline} />
                                Read
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="admin-mark-read-button"
                                onClick={() => markAsRead(notification.id)}
                              >
                                <IonIcon icon={checkmarkDoneOutline} />
                                Mark as read
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* FOOTER */}
              <footer className="admin-footer admin-notification-footer">
                <span>© {new Date().getFullYear()} GrantAccess</span>
                <span>Admin Notification Center</span>
              </footer>
            </div>
          </IonContent>
        </main>
      </div>

      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={2500}
        position="bottom"
        onDidDismiss={() => setShowToast(false)}
      />
    </IonPage>
  );
};

export default AdminNotifications;
