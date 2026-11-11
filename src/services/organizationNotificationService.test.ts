import { beforeEach, expect, it, vi } from 'vitest';
import { subscribeOrganizationNotifications, markOrganizationNotificationsRead, type OrganizationNotification } from './organizationNotificationService';
const mocks = vi.hoisted(() => ({
  listeners: new Map<string, { next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void; stop: ReturnType<typeof vi.fn> }>(),
  set: vi.fn(), commit: vi.fn(),
}));
vi.mock('../Firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }), doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  query: (ref: unknown) => ref, where: vi.fn(), serverTimestamp: () => 'server-time',
  writeBatch: () => ({ set: mocks.set, commit: mocks.commit }),
  onSnapshot: (ref: { path: string }, next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
    const stop = vi.fn(); mocks.listeners.set(ref.path, { next, stop }); return stop;
  },
}));
beforeEach(() => { vi.clearAllMocks(); mocks.listeners.clear(); });
const publish = (path: string, rows: Array<{ id: string; data: () => Record<string, unknown> }>) => mocks.listeners.get(path)!.next({ docs: rows });
const application = (id: string) => ({ id, data: () => ({ studentName: id, scholarshipTitle: 'Study grant' }) });
const item = (id: string, isRead = false): OrganizationNotification => ({ id, isRead, student: 'Student', scholarship: 'Grant', status: 'Pending', time: 0 });
it('waits for persisted read state and updates the unread count live', () => {
  const next = vi.fn(); const stop = subscribeOrganizationNotifications('org1', next, vi.fn());
  publish('applications', [application('app1')]); expect(next).not.toHaveBeenCalled();
  publish('users/org1/notifications', []); expect(next.mock.lastCall![0][0].isRead).toBe(false);
  publish('users/org1/notifications', [{ id: 'application_app1', data: () => ({ isRead: true }) }]);
  expect(next.mock.lastCall![0][0].isRead).toBe(true);
  publish('applications', [application('app1'), application('app2')]);
  expect(next.mock.lastCall![0].filter((row: OrganizationNotification) => !row.isRead).map((row: OrganizationNotification) => row.id)).toEqual(['app2']);
  stop(); expect([...mocks.listeners.values()].every(listener => listener.stop.mock.calls.length === 1)).toBe(true);
  const calls = next.mock.calls.length; publish('applications', []); expect(next).toHaveBeenCalledTimes(calls);
});
it('persists individual and bulk receipts only under the signed-in organization', async () => {
  await markOrganizationNotificationsRead('org1', [item('app1'), item('app2', true), item('app3')]);
  expect(mocks.set.mock.calls).toEqual([
    ['users/org1/notifications/application_app1', { isRead: true, readAt: 'server-time' }, { merge: true }],
    ['users/org1/notifications/application_app3', { isRead: true, readAt: 'server-time' }, { merge: true }],
  ]);
  expect(mocks.commit).toHaveBeenCalledOnce();
});
it('splits large mark-all operations into batches', async () => {
  await markOrganizationNotificationsRead('org1', Array.from({ length: 401 }, (_, index) => item(String(index))));
  expect(mocks.commit).toHaveBeenCalledTimes(2); expect(mocks.set).toHaveBeenCalledTimes(401);
});
it('propagates failed saves so the interface can offer a retry', async () => {
  mocks.commit.mockRejectedValueOnce(new Error('Permission denied'));
  await expect(markOrganizationNotificationsRead('org1', [item('app1')])).rejects.toThrow('Permission denied');
});
