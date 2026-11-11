import { useEffect, useState } from 'react';
import { IonButton, IonContent, IonPage, IonSpinner } from '@ionic/react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../Firebase/config';
import { isAdministrator } from '../../services/adminService';
import { refreshEmailVerification, sendVerificationEmail } from '../../services/emailVerificationService';

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Open the verification link in your email, then return here. If it has not arrived, check spam or resend it.');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setLoading(false); }), []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const run = async (resend: boolean) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (resend) {
        await sendVerificationEmail(user);
        setCooldown(60);
        setMessage('Verification email sent. Open its link, then select I have verified my email.');
      } else if (await refreshEmailVerification(user)) {
        if (await isAdministrator(user)) { navigate('/admin-dashboard', { replace: true }); return; }
        const organization = await getDoc(doc(db, 'organizations', user.uid));
        if (organization.exists()) {
          await updateDoc(organization.ref, { emailVerified: true });
          navigate('/lgu-dashboard', { replace: true });
        }
        else {
          const student = await getDoc(doc(db, 'students', user.uid));
          if (!student.exists()) throw new Error('Your account profile is missing. Contact the administrator.');
          await updateDoc(student.ref, { emailVerified: true });
          navigate('/student-dashboard', { replace: true });
        }
      } else setMessage('Your email is not verified yet. Open the latest verification link, then try again.');
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(code === 'auth/too-many-requests' ? 'Please wait before requesting another verification email.' : error instanceof Error ? error.message : 'Unable to check your email. Please try again.');
    } finally { setBusy(false); }
  };
  return <IonPage><IonContent className="ion-padding"><main style={{ maxWidth: 520, margin: '64px auto' }}>
    <h1>Verify your email</h1>
    {loading ? <IonSpinner /> : user ? <>
      <p>Account created for <strong>{user.email}</strong>.</p><p role="status">{message}</p>
      <IonButton expand="block" disabled={busy} onClick={() => void run(false)}>I have verified my email</IonButton>
      <IonButton expand="block" fill="outline" disabled={busy || cooldown > 0} onClick={() => void run(true)}>{cooldown ? `Resend in ${cooldown}s` : 'Resend verification email'}</IonButton>
      <IonButton fill="clear" disabled={busy} onClick={() => void signOut(auth).then(() => navigate('/register-choice', { replace: true }))}>Sign out</IonButton>
    </> : <><p>Sign in to verify your account email.</p><IonButton routerLink="/register-choice">Choose account</IonButton></>}
  </main></IonContent></IonPage>;
};
export default VerifyEmail;
