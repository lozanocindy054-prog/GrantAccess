import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../Firebase/config';
import { subscribeOrganizationNotifications, type OrganizationNotification } from '../services/organizationNotificationService';
export const useOrganizationNotifications = () => {
  const [items, setItems] = useState<OrganizationNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    let generation = 0;
    const stopAuth = onAuthStateChanged(auth, user => {
      stop?.(); stop = undefined;
      const current = ++generation;
      setItems([]); setError(''); setLoading(Boolean(user));
      if (!user) return;
      stop = subscribeOrganizationNotifications(user.uid, rows => {
        if (active && current === generation) { setItems(rows); setLoading(false); setError(''); }
      }, () => { if (active && current === generation) { setLoading(false); setError('Unable to load notifications. Please check your connection.'); } });
    });
    return () => { active = false; generation++; stopAuth(); stop?.(); };
  }, []);
  return { items, loading, error, unreadCount: items.filter(item => !item.isRead).length };
};
