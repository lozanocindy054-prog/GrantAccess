import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminAccessGate from './AdminAccessGate';
const mocks = vi.hoisted(() => ({
  user: { email: 'admin@example.com', emailVerified: true } as { email: string; emailVerified: boolean } | null,
  check: vi.fn(), listener: undefined as undefined | ((user: { email: string; emailVerified: boolean } | null) => void),
}));
vi.mock('../Firebase/config', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ onIdTokenChanged: (_auth: unknown, next: (user: { email: string; emailVerified: boolean } | null) => void) => { mocks.listener = next; next(mocks.user); return vi.fn(); } }));
vi.mock('../services/adminService', () => ({ isAdministrator: mocks.check, logoutAdministrator: vi.fn() }));
const renderGate = () => render(<MemoryRouter initialEntries={['/admin-dashboard']}><Routes>
  <Route path="/admin-dashboard" element={<AdminAccessGate><h1>Private admin dashboard</h1></AdminAccessGate>} />
  <Route path="/admin-login" element={<h1>Admin sign in</h1>} />
  <Route path="/verify-email" element={<h1>Verify account</h1>} />
</Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); mocks.user = { email: 'admin@example.com', emailVerified: true }; mocks.check.mockResolvedValue(true); });
it('redirects signed-out visitors before mounting admin data', async () => {
  mocks.user = null; renderGate();
  expect(await screen.findByText('Admin sign in')).toBeTruthy();
  expect(screen.queryByText('Private admin dashboard')).toBeNull();
});
it('blocks ordinary accounts from mounting admin pages', async () => {
  mocks.check.mockResolvedValue(false); renderGate();
  expect(await screen.findByText('Administrator access required')).toBeTruthy();
  expect(screen.queryByText('Private admin dashboard')).toBeNull();
});
it('admits verified administrators', async () => {
  renderGate(); expect(await screen.findByText('Private admin dashboard')).toBeTruthy();
});
it('requires email verification for an administrator', async () => {
  mocks.user!.emailVerified = false; renderGate();
  expect(await screen.findByText('Verify account')).toBeTruthy();
});
it('unmounts protected data when administrator access is revoked', async () => {
  renderGate(); await screen.findByText('Private admin dashboard');
  mocks.check.mockResolvedValue(false);
  await act(async () => { mocks.listener!(mocks.user); });
  expect(await screen.findByText('Administrator access required')).toBeTruthy();
  expect(screen.queryByText('Private admin dashboard')).toBeNull();
});
