import { useEffect, useState, type ReactNode } from 'react';
import { IonButton, IonContent, IonSpinner } from '@ionic/react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../Firebase/config';
import { isAdministrator, logoutAdministrator } from '../services/adminService';

const AdminAccessGate = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<{ ready: boolean; user: User | null; allowed: boolean; verified: boolean }>({ ready: false, user: null, allowed: false, verified: false });
  const [error, setError] = useState('');
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onIdTokenChanged(auth, user => {
      const current = ++generation;
      if (!user) { setState({ ready: true, user: null, allowed: false, verified: false }); return; }
      setState(previous => ({ ...previous, ready: false }));
      void isAdministrator(user).then(allowed => {
        if (current === generation) setState({ ready: true, user, allowed, verified: user.emailVerified });
      }).catch(() => {
        if (current === generation) { setError('Unable to verify administrator access. Check your connection and retry.'); setState({ ready: true, user, allowed: false, verified: user.emailVerified }); }
      });
    });
    return () => { generation++; unsubscribe(); };
  }, []);
  const protectedPage = pathname.startsWith('/admin-') && !['/admin-login', '/admin-register'].includes(pathname);
  if (!protectedPage && (!state.ready || !state.allowed || !state.verified)) return <div className="ion-page" />;
  if (!state.ready) return <div className="ion-page"><IonContent className="ion-padding"><IonSpinner aria-label="Checking administrator access" /></IonContent></div>;
  if (!state.user) return <div className="ion-page"><Navigate to="/admin-login" replace /></div>;
  if (!state.allowed) return <div className="ion-page"><IonContent className="ion-padding"><main style={{ maxWidth: 560, margin: '64px auto' }}>
    <h1>Administrator access required</h1><p>{error || `${state.user.email} does not have an administrator role.`}</p>
    <IonButton onClick={() => { setError(''); void isAdministrator(state.user!, true).then(allowed => setState(previous => ({ ...previous, allowed }))).catch(() => setError('Unable to refresh access. Please retry.')); }}>Refresh access</IonButton>
    <IonButton fill="outline" onClick={() => void logoutAdministrator().then(() => navigate('/admin-login', { replace: true })).catch(() => setError('Unable to sign out. Please retry.'))}>Sign in with another account</IonButton>
  </main></IonContent></div>;
  if (!state.verified) return <div className="ion-page"><Navigate to="/verify-email" replace /></div>;
  return <>{children}</>;
};
export default AdminAccessGate;
