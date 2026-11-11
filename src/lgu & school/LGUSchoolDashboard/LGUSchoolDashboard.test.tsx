import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import LGUSchoolDashboard from './LGUSchoolDashboard';
vi.mock('../../Firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => { next({ uid: 'org1', email: 'org@example.com' }); return vi.fn(); }, signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ path: name }), doc: (_db: unknown, collection: string) => ({ path: collection }),
  query: (ref: unknown) => ref, where: vi.fn(),
  onSnapshot: (ref: { path: string }, next: (snapshot: unknown) => void) => {
    if (ref.path === 'organizations') next({ exists: () => true, data: () => ({ organizationName: 'Test Organization' }) });
    else next({ docs: [] }); return vi.fn();
  },
}));
const renderDashboard = () => render(<MemoryRouter initialEntries={['/lgu-dashboard']}><Routes>
  <Route path="/lgu-dashboard" element={<LGUSchoolDashboard />} />
  <Route path="/lgu-scholarships" element={<h1>Scholarships page</h1>} />
  <Route path="/lgu-applications" element={<h1>Applications page</h1>} />
  <Route path="/lgu-messages" element={<h1>Messages page</h1>} />
</Routes></MemoryRouter>);
it('shows the four requested main-menu items', () => {
  renderDashboard();
  for (const name of ['Home', 'Manage Scholarships', 'Applications', 'Messages']) expect(screen.getByRole('button', { name: `Open ${name}` })).toBeTruthy();
  for (const name of ['Student Map', 'Set Map Pin', 'My Organization']) expect(screen.queryByRole('button', { name: `Open ${name}` })).toBeNull();
});
it.each([['Manage Scholarships', 'Scholarships page'], ['Applications', 'Applications page'], ['Messages', 'Messages page']])('opens %s from the card text', async (label, title) => {
  renderDashboard(); fireEvent.click(screen.getByText(label, { selector: 'strong' }));
  expect(await screen.findByText(title)).toBeTruthy();
});
