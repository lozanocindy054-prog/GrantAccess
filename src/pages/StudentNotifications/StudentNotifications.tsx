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
  arrowBackOutline,
  calendarOutline,
  cashOutline,
  checkmarkDoneOutline,
  chevronForwardOutline,
  megaphoneOutline,
  notificationsOutline,
  schoolOutline,
} from "ionicons/icons";

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../Firebase/config";

import StudentBottomNav from "../../components/StudentBottomNav";

import "./StudentNotifications.css";

// ==========================================
// TYPES
// ==========================================

interface StudentNotification {
  id: string;
  title: string;
  message: string;
  type: "scholarship" | "announcement";
  organizationName: string;
  organizationLogo: string;
  scholarshipId: string;
  scholarshipTitle: string;
  amount: string;
  deadline: string;
  imageUrl: string;
  isRead: boolean;
  createdAtMs: number;
}

type FilterTab = "all" | "unread";

// ==========================================
// HELPERS
// ==========================================

const getMillis = (value: unknown): number => {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value as string);

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const timeAgo = (milliseconds: number): string => {
  // serverTimestamp() is empty for a moment right after the write
  if (!milliseconds) return "Just now";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - milliseconds) / 1000)
  );

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(milliseconds).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatAmount = (amount: string): string => {
  if (!amount) return "";

  const value = Number(amount);

  return Number.isFinite(value)
    ? `₱${value.toLocaleString("en-PH")}`
    : amount;
};

const formatDeadline = (deadline: string): string => {
  if (!deadline) return "";

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) return deadline;

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ==========================================
// STUDENT NOTIFICATIONS PAGE
// ==========================================

const StudentNotifications: React.FC = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ========================================
  // REAL-TIME NOTIFICATION LISTENER
  // ========================================

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeNotifications?.();
      unsubscribeNotifications = undefined;

      if (!user) {
        setNotifications([]);
        setLoading(false);
        setErrorMessage("Please sign in to view your notifications.");
        return;
      }

      setLoading(true);
      setErrorMessage("");

      // No orderBy here on purpose: where + orderBy on a different field
      // needs a composite index. Sorting is done on the device instead.
      unsubscribeNotifications = onSnapshot(
        query(
          collection(db, "studentNotifications"),
          where("studentId", "==", user.uid)
        ),
        (snapshot) => {
          const rows: StudentNotification[] = snapshot.docs.map((item) => {
            const data = item.data();

            return {
              id: item.id,
              title: String(data.title || "Notification"),
              message: String(data.message || ""),
              type: data.type === "scholarship" ? "scholarship" : "announcement",
              organizationName: String(data.organizationName || ""),
              organizationLogo: String(data.organizationLogo || ""),
              scholarshipId: String(data.scholarshipId || ""),
              scholarshipTitle: String(data.scholarshipTitle || ""),
              amount: String(data.amount || ""),
              deadline: String(data.deadline || ""),
              imageUrl: String(data.imageUrl || ""),
              isRead: data.isRead === true,
              createdAtMs: getMillis(data.createdAt),
            };
          });

          rows.sort((a, b) => {
            // notifications with a pending timestamp are the newest
            const first = a.createdAtMs || Date.now();
            const second = b.createdAtMs || Date.now();

            return second - first;
          });

          setNotifications(rows);
          setLoading(false);
        },
        (error) => {
          console.error("Student notifications listener error:", error);
          setLoading(false);
          setErrorMessage(
            "Unable to load notifications. Please check your Firestore Rules."
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeNotifications?.();
    };
  }, []);

  // ========================================
  // DERIVED DATA
  // ========================================

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () =>
      activeTab === "unread"
        ? notifications.filter((item) => !item.isRead)
        : notifications,
    [activeTab, notifications]
  );

  // ========================================
  // ACTIONS
  // ========================================

  const markAsRead = async (notification: StudentNotification) => {
    if (notification.isRead) return;

    try {
      await updateDoc(doc(db, "studentNotifications", notification.id), {
        isRead: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Mark notification as read error:", error);
      setErrorMessage("Unable to mark this notification as read.");
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((item) => !item.isRead);

    if (unread.length === 0 || markingAll) return;

    setMarkingAll(true);

    try {
      for (let offset = 0; offset < unread.length; offset += 400) {
        const batch = writeBatch(db);

        unread.slice(offset, offset + 400).forEach((item) => {
          batch.update(doc(db, "studentNotifications", item.id), {
            isRead: true,
            readAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      setErrorMessage("Unable to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = (notification: StudentNotification) => {
    void markAsRead(notification);

    if (notification.scholarshipId) {
      navigate(
        `/application?scholarshipId=${encodeURIComponent(
          notification.scholarshipId
        )}`
      );
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <IonPage className="student-notifications-page">
      <IonContent fullscreen className="student-notifications-content">
        <div className="student-notifications">

          {/* HEADER */}

          <header className="student-notifications-header">
            <button
              type="button"
              className="student-notifications-back"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <IonIcon icon={arrowBackOutline} />
            </button>

            <div className="student-notifications-title">
              <h1>Notifications</h1>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>

            <button
              type="button"
              className="student-notifications-mark-all"
              onClick={markAllAsRead}
              disabled={unreadCount === 0 || markingAll}
            >
              {markingAll ? (
                <IonSpinner name="crescent" />
              ) : (
                <>
                  <IonIcon icon={checkmarkDoneOutline} />
                  Read all
                </>
              )}
            </button>
          </header>

          {/* FILTER TABS */}

          <div className="student-notifications-tabs">
            <button
              type="button"
              className={activeTab === "all" ? "selected" : ""}
              onClick={() => setActiveTab("all")}
            >
              All
              <span>{notifications.length}</span>
            </button>

            <button
              type="button"
              className={activeTab === "unread" ? "selected" : ""}
              onClick={() => setActiveTab("unread")}
            >
              Unread
              <span>{unreadCount}</span>
            </button>
          </div>

          {/* LIST */}

          {loading ? (
            <div className="student-notifications-loading">
              <IonSpinner name="crescent" />
              <span>Loading notifications...</span>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="student-notifications-empty">
              <IonIcon icon={notificationsOutline} />

              <h3>
                {activeTab === "unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </h3>

              <p>
                New scholarships and announcements from organizations
                will appear here.
              </p>
            </div>
          ) : (
            <div className="student-notifications-list">
              {visibleNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`student-notification-card ${
                    notification.isRead ? "is-read" : "is-unread"
                  }`}
                  onClick={() => openNotification(notification)}
                >
                  <div className="student-notification-avatar">
                    {notification.organizationLogo ? (
                      <img
                        src={notification.organizationLogo}
                        alt={`${notification.organizationName} logo`}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <IonIcon
                        icon={
                          notification.type === "scholarship"
                            ? schoolOutline
                            : megaphoneOutline
                        }
                      />
                    )}
                  </div>

                  <div className="student-notification-body">
                    <div className="student-notification-top">
                      <span
                        className={`student-notification-tag ${notification.type}`}
                      >
                        {notification.type === "scholarship"
                          ? "New Scholarship"
                          : "Announcement"}
                      </span>

                      <small>{timeAgo(notification.createdAtMs)}</small>
                    </div>

                    <h3>
                      {notification.scholarshipTitle || notification.title}
                    </h3>

                    <p>{notification.message}</p>

                    {notification.type === "scholarship" &&
                      (notification.amount || notification.deadline) && (
                        <div className="student-notification-meta">
                          {notification.amount && (
                            <span>
                              <IonIcon icon={cashOutline} />
                              {formatAmount(notification.amount)}
                            </span>
                          )}

                          {notification.deadline && (
                            <span>
                              <IonIcon icon={calendarOutline} />
                              Deadline: {formatDeadline(notification.deadline)}
                            </span>
                          )}
                        </div>
                      )}
                  </div>

                  <div className="student-notification-side">
                    {!notification.isRead && (
                      <span
                        className="student-notification-dot"
                        aria-label="Unread"
                      />
                    )}

                    {notification.scholarshipId && (
                      <IonIcon icon={chevronForwardOutline} />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <IonToast
            isOpen={Boolean(errorMessage)}
            message={errorMessage}
            duration={4000}
            color="danger"
            onDidDismiss={() => setErrorMessage("")}
          />
        </div>
      </IonContent>

      <StudentBottomNav />
    </IonPage>
  );
};

export default StudentNotifications;