
import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
} from "@ionic/react";
import {
  checkmarkDoneOutline,
  notificationsOutline,
  schoolOutline,
  timeOutline,
  alertCircleOutline,
} from "ionicons/icons";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { auth, db } from "../../Firebase/config";
import StudentHeader from "../../components/StudentHeader";
import StudentBottomNav from "../../components/StudentBottomNav";
import "./StudentNotifications.css";

interface StudentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt?: Timestamp | Date | string;
  scholarshipId?: string;
  postId?: string;
  organizationId?: string;
  organizationName?: string;
}

const getNotificationDate = (
  value?: Timestamp | Date | string
): Date => {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  if (typeof value === "string") {
    return new Date(value);
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }

  return new Date();
};

const formatNotificationDate = (
  value?: Timestamp | Date | string
): string => {
  if (!value) return "Just now";

  const date = getNotificationDate(value);

  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const StudentNotifications: React.FC = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<
    StudentNotification[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | undefined;
    let active = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeNotifications?.();
      unsubscribeNotifications = undefined;

      if (!user) {
        setNotifications([]);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      const notificationsQuery = query(
        collection(db, "studentNotifications"),
        where("studentId", "==", user.uid)
      );

      unsubscribeNotifications = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          if (!active) return;

          const items: StudentNotification[] = snapshot.docs.map(
            (notificationDoc) => {
              const data = notificationDoc.data();

              return {
                id: notificationDoc.id,
                title: String(
                  data.title || "New GrantAccess Update"
                ),
                message: String(data.message || ""),
                type: String(data.type || "announcement"),
                isRead: data.isRead === true,
                createdAt: data.createdAt,
                scholarshipId:
                  typeof data.scholarshipId === "string"
                    ? data.scholarshipId
                    : undefined,
                postId:
                  typeof data.postId === "string"
                    ? data.postId
                    : undefined,
                organizationId:
                  typeof data.organizationId === "string"
                    ? data.organizationId
                    : undefined,
                organizationName:
                  typeof data.organizationName === "string"
                    ? data.organizationName
                    : undefined,
              };
            }
          );

          items.sort((a, b) => {
            return (
              getNotificationDate(b.createdAt).getTime() -
              getNotificationDate(a.createdAt).getTime()
            );
          });

          setNotifications(items);
          setLoading(false);
          setError("");
        },
        (snapshotError) => {
          console.error(
            "Unable to load student notifications:",
            snapshotError
          );

          if (!active) return;

          setError(
            "Notifications could not be loaded. Please check your account permissions and internet connection."
          );
          setLoading(false);
        }
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeNotifications?.();
    };
  }, [navigate]);

  const markAsRead = async (item: StudentNotification) => {
    if (item.isRead) return;

    try {
      await updateDoc(
        doc(db, "studentNotifications", item.id),
        {
          isRead: true,
        }
      );

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === item.id
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (notificationError) {
      console.error(
        "Unable to mark notification as read:",
        notificationError
      );
    }
  };

  const openNotification = async (
    item: StudentNotification
  ) => {
    await markAsRead(item);

    if (item.scholarshipId) {
      navigate(
        `/application?scholarshipId=${encodeURIComponent(
          item.scholarshipId
        )}`
      );
      return;
    }

    if (item.postId) {
      navigate("/student-dashboard");
      return;
    }

    navigate("/scholarships");
  };

  const markAllAsRead = async () => {
    const unreadItems = notifications.filter(
      (item) => !item.isRead
    );

    if (!unreadItems.length) return;

    setUpdating(true);
    setError("");

    const results = await Promise.allSettled(
      unreadItems.map((item) =>
        updateDoc(
          doc(db, "studentNotifications", item.id),
          { isRead: true }
        )
      )
    );

    const failed = results.some(
      (result) => result.status === "rejected"
    );

    if (failed) {
      setError(
        "Some notifications could not be marked as read. Please try again."
      );
    }

    setUpdating(false);
  };

  const unreadCount = notifications.filter(
    (item) => !item.isRead
  ).length;

  return (
    <IonPage className="student-notifications-page">
      <StudentHeader />

      <IonContent className="student-notifications-content">
        <main className="student-notifications-layout">
          <header className="student-notifications-heading">
            <div className="student-notifications-heading-icon">
              <IonIcon icon={notificationsOutline} />
            </div>

            <div className="student-notifications-heading-copy">
              <span>YOUR UPDATES</span>
              <h1>Notifications</h1>
              <p>
                Stay updated with new scholarships, announcements,
                and updates from LGU and School organizations.
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={updating}
              >
                {updating ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <IonIcon icon={checkmarkDoneOutline} />
                )}
                Mark all read
              </button>
            )}
          </header>

          <div className="student-notifications-summary">
            <div>
              <strong>{notifications.length}</strong>
              <span>Total notifications</span>
            </div>

            <div>
              <strong>{unreadCount}</strong>
              <span>Unread updates</span>
            </div>
          </div>

          {error && (
            <div className="student-notifications-error">
              <IonIcon icon={alertCircleOutline} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="student-notifications-loading">
              <IonSpinner name="crescent" />
              <span>Loading your notifications...</span>
            </div>
          ) : notifications.length > 0 ? (
            <section className="student-notification-list">
              {notifications.map((item) => (
                <button
                  type="button"
                  className={`student-notification-card ${
                    item.isRead ? "" : "unread"
                  }`}
                  key={item.id}
                  onClick={() => void openNotification(item)}
                >
                  <span className="student-notification-icon">
                    <IonIcon icon={schoolOutline} />
                  </span>

                  <span className="student-notification-copy">
                    <strong>{item.title}</strong>

                    <span className="student-notification-message">
                      {item.message}
                    </span>

                    {item.organizationName && (
                      <span className="student-notification-organization">
                        From: {item.organizationName}
                      </span>
                    )}

                    <small>
                      <IonIcon icon={timeOutline} />
                      {formatNotificationDate(item.createdAt)}
                    </small>
                  </span>

                  {!item.isRead && (
                    <span className="student-notification-new">
                      NEW
                    </span>
                  )}
                </button>
              ))}
            </section>
          ) : (
            <section className="student-notifications-empty">
              <IonIcon icon={notificationsOutline} />

              <h2>You’re all caught up!</h2>

              <p>
                There are no notifications yet. New scholarship
                announcements and updates from organizations will
                appear here.
              </p>

              <button
                type="button"
                onClick={() => navigate("/scholarships")}
              >
                Explore Scholarships
              </button>
            </section>
          )}
        </main>
      </IonContent>

      <StudentBottomNav />
    </IonPage>
  );
};

export default StudentNotifications;
