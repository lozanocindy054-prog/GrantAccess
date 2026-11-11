import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { auth } from '../../Firebase/config';
import { useOrganizationNotifications } from '../../hooks/useOrganizationNotifications';
import { markOrganizationNotificationsRead, type OrganizationNotification } from '../../services/organizationNotificationService';
const OrganizationNotifications: React.FC = () => {
  const { items, loading, error, unreadCount } = useOrganizationNotifications();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const markRead = async (rows: OrganizationNotification[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid || saving) return;
    setSaving(true); setSaveError('');
    try { await markOrganizationNotificationsRead(uid, rows); }
    catch { setSaveError('Unable to mark notifications as read. Please try again.'); }
    finally { setSaving(false); }
  };
  return <IonPage><IonHeader><IonToolbar><IonButtons slot="start"><IonBackButton defaultHref="/lgu-dashboard" /></IonButtons><IonTitle>Notifications</IonTitle></IonToolbar></IonHeader>
    <IonContent className="ion-padding"><main style={{ maxWidth: 800, margin: '24px auto' }} aria-busy={saving}>
      <h1>Recent applications</h1><p>Updates from students applying to your scholarships.</p>
      <p aria-live="polite">{unreadCount} unread</p>
      <IonButton fill="outline" disabled={loading || saving || unreadCount === 0} onClick={() => void markRead(items)}>Mark all as read</IonButton>
      {(saveError || error) && <p role="alert">{saveError || error}</p>}
      {loading ? <IonSpinner /> : !items.length ? <p>No applications yet.</p> : items.map(item => <article key={item.id} style={{ padding: 20, marginTop: 12, border: '1px solid #e5ece7', borderRadius: 12, background: item.isRead ? '#fff' : '#edf8f0' }}>
        <h2 style={{ fontSize: 18 }}>{item.student}</h2><p>{item.scholarship}</p><p>Status: {item.status}</p>
        {item.time > 0 && <p>{new Date(item.time).toLocaleString('en-PH')}</p>}
        <p>{item.isRead ? 'Read' : 'Unread'}</p>
        {!item.isRead && <IonButton size="small" disabled={saving} onClick={() => void markRead([item])}>Mark as read</IonButton>}
        <IonButton size="small" fill="outline" routerLink="/lgu-applications">View applications</IonButton>
      </article>)}
    </main></IonContent>
  </IonPage>;
};
export default OrganizationNotifications;
