import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../Firebase/config';
const OrganizationSettings: React.FC = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reset = async () => {
    const email = auth.currentUser?.email;
    if (!email || busy) return;
    setBusy(true); setMessage('');
    try { await sendPasswordResetEmail(auth, email); setMessage('Password reset email sent. Check your inbox.'); }
    catch { setMessage('Unable to send the email. Please try again.'); }
    finally { setBusy(false); }
  };
  return <IonPage><IonHeader><IonToolbar><IonButtons slot="start"><IonBackButton defaultHref="/lgu-dashboard" /></IonButtons><IonTitle>Organization Settings</IonTitle></IonToolbar></IonHeader>
    <IonContent className="ion-padding"><main style={{ maxWidth: 680, margin: '32px auto' }}>
      <h1>Account settings</h1><p>{auth.currentUser?.email}</p>
      <IonButton routerLink="/lgu-school-profile">Manage organization details</IonButton>
      <IonButton fill="outline" disabled={busy} onClick={() => void reset()}>Send password reset email</IonButton>
      {message && <p role="status">{message}</p>}
      <p><IonButton color="danger" fill="outline" onClick={() => void signOut(auth).then(() => navigate('/lgu-login', { replace: true })).catch(() => setMessage('Unable to sign out. Please retry.'))}>Sign out</IonButton></p>
    </main></IonContent>
  </IonPage>;
};
export default OrganizationSettings;
