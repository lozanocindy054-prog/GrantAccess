import { useEffect, useState, type ReactNode } from 'react';
import { IonButton, IonContent, IonSpinner } from '@ionic/react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Navigate, useMatch, useNavigate } from 'react-router-dom';
import { auth, db } from '../Firebase/config';

type AccountRole = 'student' | 'organization' | 'any';
interface Props { children: ReactNode; role?: AccountRole; path: string; requireVerification?: boolean; }
const EmailVerificationGate = ({ children, role = 'student', path, requireVerification = true }: Props) => {
  const active = Boolean(useMatch({ path, end: true }));
  const navigate = useNavigate();
  const loginPath = role === 'organization' ? '/lgu-login' : role === 'student' ? '/login' : '/register-choice';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ ready: boolean; user: User | null; allowed: boolean; verified: boolean; error: string }>({ ready: false, user: null, allowed: false, verified: false, error: '' });
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onIdTokenChanged(auth, user => {
      const current = ++generation;
      if (!user) { setState({ ready: true, user: null, allowed: false, verified: false, error: '' }); return; }
      if (role === 'any' || !user.emailVerified) { setState({ ready: true, user, allowed: true, verified: user.emailVerified, error: '' }); return; }
      setState(previous => ({ ...previous, ready: false }));
      const collection = role === 'organization' ? 'organizations' : 'students';
      void getDoc(doc(db, collection, user.uid)).then(profile => {
        if (current !== generation) return;
        const expected = role === 'organization' ? 'lgu_school' : 'student';
        setState({ ready: true, user, allowed: profile.exists() && profile.data().role === expected, verified: user.emailVerified, error: '' });
      }).catch(() => {
        if (current === generation) setState({ ready: true, user, allowed: false, verified: user.emailVerified, error: 'Unable to verify your account. Check your connection and retry.' });
      });
    });
    return () => { generation++; unsubscribe(); };
  }, [role, attempt]);
  const admitted = state.ready && state.user && state.allowed && (!requireVerification || state.verified);
  // Loading/redirect placeholders must not register an Ionic page. Only the admitted
  // screen registers with the outlet, preventing stale hidden-page references.
  // Cached pages still unmount protected data without redirecting an unrelated page.
  if (!active && !admitted) return <div className="ion-page" />;
  if (!state.ready) return <div className="ion-page"><IonContent className="ion-padding"><IonSpinner aria-label="Checking account access" /></IonContent></div>;
  if (!state.user) return <div className="ion-page"><Navigate to={loginPath} replace /></div>;
  if (requireVerification && !state.verified) return <div className="ion-page"><Navigate to="/verify-email" replace /></div>;
  if (!state.allowed) return <div className="ion-page"><IonContent className="ion-padding"><main style={{ maxWidth: 560, margin: '64px auto' }}>
    <h1>{role === 'organization' ? 'Organization account required' : 'Student account required'}</h1>
    <p>{state.error || 'Sign in with the correct account type to open this page.'}</p>
    {state.error && <IonButton onClick={() => setAttempt(value => value + 1)}>Retry</IonButton>}
    <IonButton onClick={() => void signOut(auth).then(() => navigate(loginPath, { replace: true }))}>Sign in with another account</IonButton>
  </main></IonContent></div>;
  return <>{children}</>;
};
export default EmailVerificationGate;
