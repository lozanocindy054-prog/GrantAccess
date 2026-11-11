import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { refreshEmailVerification, sendVerificationEmail } from './emailVerificationService';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('firebase/auth', () => ({ sendEmailVerification: mocks.send }));
beforeEach(() => vi.clearAllMocks());
describe('Spark email verification', () => {
  it('uses Firebase Auth to send a verification link', async () => {
    const user = { uid: 'org' } as User;
    await sendVerificationEmail(user);
    expect(mocks.send).toHaveBeenCalledWith(user);
  });
  it('does not accept an email that Firebase has not verified', async () => {
    const user = { reload: vi.fn(), getIdToken: vi.fn(), emailVerified: false };
    expect(await refreshEmailVerification(user as unknown as User)).toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
  it('reloads the user and refreshes the verified token', async () => {
    const user = { reload: vi.fn(), getIdToken: vi.fn(), emailVerified: true };
    expect(await refreshEmailVerification(user as unknown as User)).toBe(true);
    expect(user.reload).toHaveBeenCalledOnce();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
});
