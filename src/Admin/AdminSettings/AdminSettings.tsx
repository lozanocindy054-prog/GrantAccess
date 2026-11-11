import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../Firebase/config';
import { isAdministrator, logoutAdministrator } from '../../services/adminService';

const AdminSettings: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: 'refresh' | 'password' | 'logout') => {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true); setMessage('');
    try {
      if (action === 'password') { await sendPasswordResetEmail(auth, user.email || ''); setMessage('Password reset email sent. Check your inbox.'); }
      else if (action === 'refresh') { const allowed = await isAdministrator(user, true); setMessage(allowed ? 'Administrator access is active.' : 'Administrator access has been removed.'); }
      else { await logoutAdministrator(); navigate('/admin-login', { replace: true }); }
    } catch { setMessage('Unable to complete this action. Please retry.'); }
    finally { setBusy(false); }
  };
  return <IonPage><IonHeader><IonToolbar><IonButtons slot="start"><IonBackButton defaultHref="/admin-dashboard" /></IonButtons><IonTitle>System Settings</IonTitle></IonToolbar></IonHeader>
    <IonContent className="ion-padding"><main style={{ maxWidth: 720, margin: '32px auto' }}>
      <h1>Administrator account</h1><p>{auth.currentUser?.email}</p><p>Access: Administrator</p>
      <IonButton disabled={busy} onClick={() => void run('refresh')}>Refresh access</IonButton>
      <IonButton fill="outline" disabled={busy} onClick={() => void run('password')}>Send password reset email</IonButton>
      <h2>Upload limits</h2><p>Documents and receipts: 650 KB each. Profile and post images: 128 KB each.</p>
      <h2>Publishing</h2><p>Publish immediately or save a draft for later. Automatic scheduling is unavailable.</p>
      {message && <p role="status">{message}</p>}
      <IonButton color="danger" fill="outline" disabled={busy} onClick={() => void run('logout')}>Sign out</IonButton>
    </main></IonContent>
  </IonPage>;
};
export default AdminSettings;
