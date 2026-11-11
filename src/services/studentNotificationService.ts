import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from '../Firebase/config';
import { parseDate } from '../utils/dates';

export interface StudentNotification {
  id: string; sourceId: string; source: 'personal' | 'announcement';
  title: string; message: string; type: 'scholarship' | 'announcement';
  organizationName: string; organizationLogo: string; scholarshipId: string;
  scholarshipTitle: string; amount: string; deadline: string; imageUrl: string;
  isRead: boolean; createdAtMs: number;
}
export const subscribeStudentNotifications = (studentId: string, next: (items: StudentNotification[]) => void, onError: (error: Error) => void): (() => void) => {
  let active = true;
  const personal = new Map<string, DocumentData>();
  const announcements = new Map<string, DocumentData>();
  const reads = new Set<string>();
  const ready = new Set<string>();
  const emit = () => {
    if (!active || ready.size < 3) return;
    const map = (entries: Map<string, DocumentData>, source: 'personal' | 'announcement'): StudentNotification[] => Array.from(entries, ([id, data]) => ({
      id: source === 'announcement' ? `announcement_${id}` : id, sourceId: id, source,
      title: String(data.title || 'Notification'), message: String(data.message || ''),
      type: data.type === 'scholarship' ? 'scholarship' : 'announcement',
      organizationName: String(data.organizationName || ''), organizationLogo: String(data.organizationLogo || ''),
      scholarshipId: String(data.scholarshipId || ''), scholarshipTitle: String(data.scholarshipTitle || ''),
      amount: String(data.amount || ''), deadline: String(data.deadline || ''), imageUrl: String(data.imageUrl || ''),
      isRead: source === 'announcement' ? reads.has(id) : data.isRead === true,
      createdAtMs: parseDate(data.createdAt)?.getTime() || 0,
    }));
    next([...map(personal, 'personal'), ...map(announcements, 'announcement')].sort((a, b) => b.createdAtMs - a.createdAtMs));
  };
  const fail = (error: Error) => { if (active) onError(error); };
  const unsubs = [
    onSnapshot(query(collection(db, 'studentNotifications'), where('studentId', '==', studentId)), snapshot => {
      personal.clear(); snapshot.docs.forEach(item => personal.set(item.id, item.data())); ready.add('personal'); emit();
    }, fail),
    onSnapshot(query(collection(db, 'studentAnnouncements'), orderBy('createdAt', 'desc'), limit(100)), snapshot => {
      announcements.clear(); snapshot.docs.forEach(item => announcements.set(item.id, item.data())); ready.add('announcements'); emit();
    }, fail),
    onSnapshot(collection(db, 'studentAnnouncementReads', studentId, 'items'), snapshot => {
      reads.clear(); snapshot.docs.forEach(item => { if (item.data().isRead === true) reads.add(item.id); }); ready.add('reads'); emit();
    }, fail),
  ];
  return () => { active = false; unsubs.forEach(unsubscribe => unsubscribe()); };
};
export const markStudentNotificationsRead = async (studentId: string, items: StudentNotification[]): Promise<void> => {
  const unread = items.filter(item => !item.isRead);
  for (let offset = 0; offset < unread.length; offset += 400) {
    const batch = writeBatch(db);
    unread.slice(offset, offset + 400).forEach(item => {
      if (item.source === 'announcement') batch.set(doc(db, 'studentAnnouncementReads', studentId, 'items', item.sourceId), { isRead: true, readAt: serverTimestamp() });
      else batch.update(doc(db, 'studentNotifications', item.sourceId), { isRead: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
};
export const publishStudentAnnouncement = async <T extends { postId: string; organizationId: string; title: string; message: string }>(payload: T): Promise<void> => {
  await setDoc(doc(db, 'studentAnnouncements', payload.postId), { ...payload, title: payload.title.slice(0, 200), message: payload.message.slice(0, 600), createdAt: serverTimestamp() });
};
