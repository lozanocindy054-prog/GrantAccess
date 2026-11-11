import { useAppBack } from '../hooks/useAppBack';
import { useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';
import { recordVisitedPath } from '../utils/backNavigation';
import './GlobalBackButton.css';

const ownNavigation = [/^\/forgot-password$/, /^\/student-location$/, /^\/organization-profile\/[^/]+$/, /^\/application$/, /^\/application-history$/, /^\/scholarships$/, /^\/admin-settings$/, /^\/lgu-settings$/, /^\/lgu-notifications$/];
const homes = new Set(['/', '/register-choice', '/student-dashboard', '/student-home', '/lgu-dashboard', '/admin-dashboard', '/verify-email']);
const GlobalBackButton: React.FC = () => {
  const goBack = useAppBack();
  const { pathname, key } = useLocation();
  const visible = !homes.has(pathname) && !ownNavigation.some(pattern => pattern.test(pathname));
  useEffect(() => {
    const index = window.history.state?.idx;
    if (typeof index === 'number') recordVisitedPath(index, pathname);
    const app = document.querySelector('ion-app');
    app?.classList.toggle('ga-with-backbar', visible);
    return () => app?.classList.remove('ga-with-backbar');
  }, [pathname, key, visible]);
  if (!visible) return null;
  return <nav className="global-backbar" aria-label="Page navigation">
    <button type="button" className="global-back-button app-back-control" onClick={goBack} aria-label="Go back">
      <IonIcon icon={arrowBackOutline} aria-hidden="true" /><span>Back</span>
    </button>
  </nav>;
};
export default GlobalBackButton;
