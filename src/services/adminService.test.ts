import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAdministrator, loginAdministrator, logoutAdministrator, reviewApplicationAsAdmin } from './adminService';
import type { User } from 'firebase/auth';
const mocks = vi.hoisted(() => ({
  user: { uid: 'admin1', email: 'admin@example.com', emailVerified: true, displayName: 'Admin' },
  signIn: vi.fn(), signOut: vi.fn(), token: vi.fn(), addDoc: vi.fn(), update: vi.fn(), set: vi.fn(), commit: vi.fn(),
}));
vi.mock('../Firebase/config', () => ({ auth: { get currentUser() { return mocks.user; } }, db: {} }));
vi.mock('firebase/auth', () => ({ getIdTokenResult: mocks.token, signInWithEmailAndPassword: mocks.signIn, signOut: mocks.signOut }));
vi.mock('firebase/firestore', () => ({
  addDoc: mocks.addDoc, collection: (_db: unknown, name: string) => name,
  doc: (...args: unknown[]) => args.filter(arg => typeof arg === 'string').join('/'),
  serverTimestamp: () => 'server-time', writeBatch: () => ({ update: mocks.update, set: mocks.set, commit: mocks.commit }),
}));
beforeEach(() => {
  vi.clearAllMocks(); mocks.signIn.mockResolvedValue({ user: mocks.user });
  mocks.token.mockResolvedValue({ claims: { admin: true } }); mocks.addDoc.mockResolvedValue({ id: 'log1' });
});
describe('administrator access', () => {
  it('requires a real admin token claim rather than a profile role', async () => {
    mocks.token.mockResolvedValue({ claims: { role: 'admin' } });
    expect(await isAdministrator(mocks.user as User)).toBe(false);
  });
  it('signs ordinary accounts out when they attempt admin login', async () => {
    mocks.token.mockResolvedValue({ claims: {} });
    await expect(loginAdministrator('student@example.com', 'password')).rejects.toMatchObject({ code: 'auth/admin-required' });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.addDoc).not.toHaveBeenCalled();
  });
  it('refreshes claims before accepting administrator login', async () => {
    await loginAdministrator(' ADMIN@example.com ', 'password');
    expect(mocks.token).toHaveBeenCalledWith(mocks.user, true);
    expect(mocks.addDoc).toHaveBeenCalledWith('activityLogs', expect.objectContaining({ userId: 'admin1', action: 'Admin login' }));
  });
  it('signs out even if activity logging fails', async () => {
    mocks.addDoc.mockRejectedValueOnce(new Error('unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await logoutAdministrator();
    expect(mocks.signOut).toHaveBeenCalledOnce(); warn.mockRestore();
  });
  it('commits a review and its audit record in one batch', async () => {
    await reviewApplicationAsAdmin('app1', 'Approved');
    expect(mocks.update).toHaveBeenCalledWith('applications/app1', expect.objectContaining({ status: 'Approved', reviewedBy: 'admin1', reviewedAt: 'server-time' }));
    expect(mocks.set).toHaveBeenCalledWith('activityLogs', expect.objectContaining({ action: 'Application reviewed', userId: 'admin1' }));
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
