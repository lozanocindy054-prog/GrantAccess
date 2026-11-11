import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../Firebase/config';
import { parseDate } from '../utils/dates';

export interface OrganizationNotification {
  id: string; student: string; scholarship: string; status: string; time: number; isRead: boolean;
}
export const subscribeOrganizationNotifications = (uid: string, next: (items: OrganizationNotification[]) => void, error: (error: Error) => void): (() => void) => {
  let active = true;
  let applications: Omit<OrganizationNotification, 'isRead'>[] = [];
  const reads = new Set<string>();
  const ready = new Set<string>();
  const emit = () => {
    if (active && ready.size === 2) next(applications.map(item => ({ ...item, isRead: reads.has(`application_${item.id}`) })).sort((a, b) => b.time - a.time));
  };
  const fail = (cause: Error) => { if (active) error(cause); };
  const stopApplications = onSnapshot(query(collection(db, 'applications'), where('organizationId', '==', uid)), snapshot => {
    applications = snapshot.docs.map(item => {
      const data = item.data();
      return { id: item.id, student: String(data.studentName || data.fullName || 'Student'), scholarship: String(data.scholarshipTitle || data.scholarshipName || 'Scholarship'), status: String(data.status || 'Pending'), time: parseDate(data.submittedAt || data.createdAt)?.getTime() || 0 };
    });
    ready.add('applications'); emit();
  }, fail);
  const stopReads = onSnapshot(collection(db, 'users', uid, 'notifications'), snapshot => {
    reads.clear(); snapshot.docs.forEach(item => { if (item.data().isRead === true) reads.add(item.id); });
    ready.add('reads'); emit();
  }, fail);
  return () => { active = false; stopApplications(); stopReads(); };
};
export const markOrganizationNotificationsRead = async (uid: string, items: OrganizationNotification[]): Promise<void> => {
  const unread = items.filter(item => !item.isRead);
  for (let offset = 0; offset < unread.length; offset += 400) {
    const batch = writeBatch(db);
    unread.slice(offset, offset + 400).forEach(item => batch.set(doc(db, 'users', uid, 'notifications', `application_${item.id}`), { isRead: true, readAt: serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
};
