
import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  documentTextOutline,
  homeOutline,
  personOutline,
  schoolOutline,
} from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import './StudentBottomNav.css';

const navigationItems = [
  { label: 'Home', path: '/student-dashboard', icon: homeOutline },
  { label: 'Scholarships', path: '/scholarships', icon: schoolOutline },
  { label: 'History', path: '/application-history', icon: documentTextOutline },
  { label: 'Profile', path: '/profile', icon: personOutline },
];

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="student-bottom-navigation" aria-label="Student navigation">
      {navigationItems.map((item) => {
        const active = location.pathname === item.path;

        return (
          <button
            type="button"
            key={item.path}
            className={`student-bottom-navigation-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
          >
            <IonIcon icon={item.icon} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default StudentBottomNav;
