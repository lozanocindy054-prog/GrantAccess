import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import OrganizationNotifications from './OrganizationNotifications';
import type { OrganizationNotification } from '../../services/organizationNotificationService';
const mocks = vi.hoisted(() => ({ emit: undefined as undefined | ((rows: OrganizationNotification[]) => void), mark: vi.fn() }));
vi.mock('../../Firebase/config', () => ({ auth: { currentUser: { uid: 'org1' } } }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: unknown, next: (user: { uid: string }) => void) => { next({ uid: 'org1' }); return vi.fn(); } }));
vi.mock('../../services/organizationNotificationService', () => ({
  subscribeOrganizationNotifications: (_uid: string, next: (rows: OrganizationNotification[]) => void) => { mocks.emit = next; return vi.fn(); },
  markOrganizationNotificationsRead: mocks.mark,
}));
const row = (id: string, isRead = false): OrganizationNotification => ({ id, student: id, scholarship: 'Study grant', status: 'Pending', time: 0, isRead });
beforeEach(() => { mocks.mark.mockReset(); mocks.mark.mockResolvedValue(undefined); });
it('marks one notification read and updates its status from live receipts', async () => {
  render(<MemoryRouter><OrganizationNotifications /></MemoryRouter>);
  act(() => mocks.emit!([row('app1')]));
  fireEvent.click(screen.getByText('Mark as read'));
  await waitFor(() => expect(mocks.mark).toHaveBeenCalledWith('org1', [row('app1')]));
  act(() => mocks.emit!([row('app1', true)]));
  expect(screen.getByText('0 unread')).toBeTruthy(); expect(screen.queryByText('Mark as read')).toBeNull();
});
it('offers mark-all and displays failed saves without marking items read', async () => {
  mocks.mark.mockRejectedValueOnce(new Error('Offline'));
  render(<MemoryRouter><OrganizationNotifications /></MemoryRouter>);
  const rows = [row('app1'), row('app2')]; act(() => mocks.emit!(rows));
  fireEvent.click(screen.getByText('Mark all as read'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to mark notifications as read');
  expect(mocks.mark).toHaveBeenCalledWith('org1', rows);
  expect(screen.getByText('2 unread')).toBeTruthy(); expect(screen.getAllByText('Mark as read')).toHaveLength(2);
});
