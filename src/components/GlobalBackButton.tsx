import React from 'react';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import './GlobalBackButton.css';

const routesWithOwnBackButton = [
  /^\/forgot-password$/,
  /^\/student-location$/,
  /^\/organization-profile\/[^/]+$/,
  /^\/application$/,
  /^\/lgu-student-map$/,
];

const getFallbackPath = (pathname: string): string => {
  if (/^\/admin-(dashboard|students|organizations|scholarships|applications|reports|notifications|activity-logs)$/.test(pathname)) {
    return '/admin-dashboard';
  }

  if (/^\/lgu-(dashboard|school-profile|scholarships|applications|messages|student-map)$/.test(pathname)) {
    return '/lgu-dashboard';
  }

  if (
    /^\/(student-dashboard|student-location|scholarships|application-history|saved|profile|student-messages|notifications)$/.test(
      pathname
    ) ||
    /^\/organization-profile\/[^/]+$/.test(pathname) ||
    pathname === '/application'
  ) {
    return '/student-dashboard';
  }

  return '/register-choice';
};

const GlobalBackButton: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (
    pathname === '/' ||
    routesWithOwnBackButton.some((route) => route.test(pathname))
  ) {
    return null;
  }

  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(getFallbackPath(pathname), { replace: true });
  };

  return (
    <button
      type="button"
      className="global-back-button"
      onClick={goBack}
      aria-label="Go back"
      title="Go back"
    >
      <IonIcon icon={arrowBackOutline} aria-hidden="true" />
    </button>
  );
};

export default GlobalBackButton;
