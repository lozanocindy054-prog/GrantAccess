import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markStudentNotificationsRead, publishStudentAnnouncement, subscribeStudentNotifications, type StudentNotification } from './studentNotificationService';
const mocks = vi.hoisted(() => ({
  listeners: [] as Array<{ path: string; next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void; stop: ReturnType<typeof vi.fn> }>,
  set: vi.fn(), update: vi.fn(), commit: vi.fn(), setDoc: vi.fn(),
}));
vi.mock('../Firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  query: (ref: unknown) => ref, where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  serverTimestamp: () => 'server-time', setDoc: mocks.setDoc,
  writeBatch: () => ({ set: mocks.set, update: mocks.update, commit: mocks.commit }),
  onSnapshot: (ref: { path: string }, next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
    const stop = vi.fn(); mocks.listeners.push({ path: ref.path, next, stop }); return stop;
  },
}));
beforeEach(() => { vi.clearAllMocks(); mocks.listeners.length = 0; });
describe('Spark student announcements', () => {
  it('publishes one deterministic announcement without reading student profiles', async () => {
    const payload = { postId: 'post1', organizationId: 'school1', title: 'New scholarship', message: 'Available now' };
    await publishStudentAnnouncement(payload);
    await publishStudentAnnouncement(payload);
    expect(mocks.setDoc.mock.calls.map(call => call[0])).toEqual(['studentAnnouncements/post1', 'studentAnnouncements/post1']);
  });
  it('combines legacy notifications and shared announcements with private read state', () => {
    const next = vi.fn();
    const unsubscribe = subscribeStudentNotifications('student1', next, vi.fn());
    mocks.listeners.find(item => item.path === 'studentNotifications')!.next({ docs: [{ id: 'legacy1', data: () => ({ title: 'Personal', isRead: false }) }] });
    mocks.listeners.find(item => item.path === 'studentAnnouncements')!.next({ docs: [{ id: 'post1', data: () => ({ title: 'Shared' }) }] });
    expect(next).not.toHaveBeenCalled();
    mocks.listeners.find(item => item.path === 'studentAnnouncementReads/student1/items')!.next({ docs: [{ id: 'post1', data: () => ({ isRead: true }) }] });
    expect(next.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'personal', title: 'Personal', isRead: false }),
      expect.objectContaining({ source: 'announcement', title: 'Shared', isRead: true }),
    ]));
    unsubscribe();
    expect(mocks.listeners.every(item => item.stop.mock.calls.length === 1)).toBe(true);
  });
  it('marks a shared announcement read only for the current student', async () => {
    await markStudentNotificationsRead('student1', [{ source: 'announcement', sourceId: 'post1', isRead: false } as StudentNotification]);
    expect(mocks.set).toHaveBeenCalledWith('studentAnnouncementReads/student1/items/post1', { isRead: true, readAt: 'server-time' });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it('still marks a legacy personal notification read', async () => {
    await markStudentNotificationsRead('student1', [{ source: 'personal', sourceId: 'legacy1', isRead: false } as StudentNotification]);
    expect(mocks.update).toHaveBeenCalledWith('studentNotifications/legacy1', expect.objectContaining({ isRead: true }));
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
