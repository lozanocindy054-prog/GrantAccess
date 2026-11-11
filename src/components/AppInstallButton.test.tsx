import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AppInstallButton from './AppInstallButton';
it('offers browser instructions when an install prompt is unavailable', () => {
  render(<AppInstallButton />); fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
  expect(screen.getByRole('status')).toHaveTextContent('browser menu');
});
it('uses the browser install prompt and hides the button after acceptance', async () => {
  render(<AppInstallButton />);
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull());
  expect(prompt).toHaveBeenCalledOnce();
});
it('removes the install action when the browser reports installation', () => {
  render(<AppInstallButton />); act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
});
