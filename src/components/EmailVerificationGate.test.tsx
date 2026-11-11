import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import EmailVerificationGate from './EmailVerificationGate';
const mocks = vi.hoisted(() => ({
  user: null as null | { uid: string; emailVerified: boolean }, profileRole: 'lgu_school', getDoc: vi.fn(),
  listener: undefined as undefined | ((user: { uid: string; emailVerified: boolean } | null) => void),
}));
vi.mock('../Firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ onIdTokenChanged: (_auth: unknown, next: (user: { uid: string; emailVerified: boolean } | null) => void) => { mocks.listener = next; next(mocks.user); return vi.fn(); }, signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: mocks.getDoc }));
const renderGate = (role: 'organization' | 'student' = 'organization') => render(<MemoryRouter initialEntries={['/protected']}><Routes>
  <Route path="/protected" element={<EmailVerificationGate role={role} path="/protected"><h1>Private portal</h1></EmailVerificationGate>} />
  <Route path="/lgu-login" element={<h1>Organization login</h1>} />
  <Route path="/login" element={<h1>Student login</h1>} />
  <Route path="/verify-email" element={<h1>Verify email first</h1>} />
</Routes></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); mocks.user = null; mocks.profileRole = 'lgu_school';
  mocks.getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ role: mocks.profileRole }) }));
});
it('redirects signed-out organization visitors before mounting private pages', async () => {
  renderGate(); expect(await screen.findByText('Organization login')).toBeTruthy();
  expect(screen.queryByText('Private portal')).toBeNull(); expect(mocks.getDoc).not.toHaveBeenCalled();
});
it('redirects signed-out students to student login', async () => {
  renderGate('student'); expect(await screen.findByText('Student login')).toBeTruthy();
});
it('requires email verification before mounting portal data', async () => {
  mocks.user = { uid: 'org1', emailVerified: false }; renderGate();
  expect(await screen.findByText('Verify email first')).toBeTruthy(); expect(mocks.getDoc).not.toHaveBeenCalled();
});
it('rejects an account from another role', async () => {
  mocks.user = { uid: 'student1', emailVerified: true }; mocks.profileRole = 'student'; renderGate();
  expect(await screen.findByText('Organization account required')).toBeTruthy(); expect(screen.queryByText('Private portal')).toBeNull();
});
it('mounts the organization interface for a verified organization account', async () => {
  mocks.user = { uid: 'org1', emailVerified: true }; renderGate();
  expect(await screen.findByText('Private portal')).toBeTruthy();
});
it('removes protected interfaces immediately after sign-out', async () => {
  mocks.user = { uid: 'org1', emailVerified: true }; renderGate(); await screen.findByText('Private portal');
  await act(async () => { mocks.listener!(null); });
  expect(await screen.findByText('Organization login')).toBeTruthy(); expect(screen.queryByText('Private portal')).toBeNull();
});
