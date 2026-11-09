
import React, { FormEvent, useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  bookmarkOutline,
  chatbubbleOutline,
  documentTextOutline,
  homeOutline,
  notificationsOutline,
  personOutline,
  schoolOutline,
  searchOutline,
} from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../Firebase/config';
import './StudentHeader.css';

const navigationItems = [
  { label: 'Home', path: '/student-dashboard', icon: homeOutline },
  { label: 'Scholarships', path: '/scholarships', icon: schoolOutline },
  { label: 'Saved', path: '/saved', icon: bookmarkOutline },
  {
    label: 'Applications',
    path: '/application-history',
    icon: documentTextOutline,
  },
  { label: 'Messages', path: '/student-messages', icon: chatbubbleOutline },
  { label: 'Profile', path: '/profile', icon: personOutline },
];

const StudentHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchText, setSearchText] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;
    let authGeneration = 0;

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let visibilityHandler: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const currentGeneration = ++authGeneration;

      // Clean up previous account listeners.
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }

      if (visibilityHandler) {
        document.removeEventListener(
          'visibilitychange',
          visibilityHandler
        );
        visibilityHandler = undefined;
      }

      unsubscribeNotifications?.();
      unsubscribeNotifications = undefined;

      setUnreadNotifications(0);

      // No authenticated user.
      if (!user) {
        return;
      }

      try {
        // 1. Verify that the authenticated user has a Student document.
        const studentRef = doc(db, 'students', user.uid);
        const studentSnapshot = await getDoc(studentRef);

        if (
          !active ||
          currentGeneration !== authGeneration ||
          !studentSnapshot.exists()
        ) {
          return;
        }

        // 2. Listen to this student's notifications only.
        const notificationsQuery = query(
          collection(db, 'studentNotifications'),
          where('studentId', '==', user.uid)
        );

        unsubscribeNotifications = onSnapshot(
          notificationsQuery,
          (snapshot) => {
            if (!active || currentGeneration !== authGeneration) {
              return;
            }

            const unreadCount = snapshot.docs.filter(
              (notification) =>
                notification.data().isRead !== true
            ).length;

            setUnreadNotifications(unreadCount);
          },
          (error) => {
            console.error(
              'Unable to load unread notification count:',
              error.code,
              error.message
            );
          }
        );

        // 3. Update Student online presence.
        const presenceRef = doc(
          db,
          'studentPresence',
          user.uid
        );

        const updatePresence = async (online: boolean) => {
          if (!active || currentGeneration !== authGeneration) {
            return;
          }

          try {
            await setDoc(
              presenceRef,
              {
                studentId: user.uid,
                online,
                lastActive: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (error) {
            console.error(
              'Unable to update student activity:',
              error
            );
          }
        };

        // 4. Detect whether the browser tab is visible.
        visibilityHandler = () => {
          void updatePresence(
            document.visibilityState === 'visible'
          );
        };

        visibilityHandler();

        // 5. Update activity every 60 seconds.
        heartbeat = setInterval(() => {
          if (visibilityHandler) {
            visibilityHandler();
          }
        }, 60_000);

        document.addEventListener(
          'visibilitychange',
          visibilityHandler
        );

      } catch (error) {
        if (active && currentGeneration === authGeneration) {
          console.error(
            'Unable to initialize student activity:',
            error
          );
        }
      }
    });

    return () => {
      active = false;
      authGeneration++;

      unsubscribeAuth();
      unsubscribeNotifications?.();

      if (heartbeat) {
        clearInterval(heartbeat);
      }

      if (visibilityHandler) {
        document.removeEventListener(
          'visibilitychange',
          visibilityHandler
        );
      }
    };
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const search = searchText.trim();
    const searchQuery = search
      ? `?search=${encodeURIComponent(search)}`
      : '';

    navigate(`/scholarships${searchQuery}`);
  };

  return (
    <header className="student-global-header">
      <a
        className="student-global-brand"
        href="/student-dashboard"
        onClick={(event) => {
          event.preventDefault();
          navigate('/student-dashboard');
        }}
        aria-label="GrantAccess home"
      >
        <img src="/image/logo3.png" alt="" />
        <span>GrantAccess</span>
      </a>

      <form
        className="student-global-search"
        onSubmit={handleSearch}
        role="search"
      >
        <IonIcon icon={searchOutline} aria-hidden="true" />

        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search scholarships"
          aria-label="Search scholarships"
        />
      </form>

      <nav
        className="student-global-nav"
        aria-label="Student navigation"
      >
        {navigationItems.map((item) => {
          const active = location.pathname === item.path;

          return (
            <button
              type="button"
              key={item.path}
              className={`student-global-nav-item${
                active ? ' active' : ''
              }`}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              <IonIcon icon={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="student-global-notifications"
        aria-label={`Open notifications${
          unreadNotifications > 0
            ? `, ${unreadNotifications} unread`
            : ''
        }`}
        onClick={() => navigate('/notifications')}
      >
        <IonIcon
          icon={notificationsOutline}
          aria-hidden="true"
        />

        {unreadNotifications > 0 && (
          <span className="student-notification-count">
            {unreadNotifications > 99
              ? '99+'
              : unreadNotifications}
          </span>
        )}
      </button>
    </header>
  );
};

export default StudentHeader;
