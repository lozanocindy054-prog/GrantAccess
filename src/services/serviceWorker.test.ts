import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
const script = readFileSync('scripts/service-worker.js', 'utf8');
const handlers = new Map<string, (event: unknown) => void>();
const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
const storage = { open: vi.fn().mockResolvedValue(cache), match: vi.fn().mockResolvedValue('offline-page'), keys: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue(true) };
const fetchRequest = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); handlers.clear();
  new Function('self', 'caches', 'fetch', 'URL', script)({ location: { origin: 'https://grand-access.web.app' }, addEventListener: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback), skipWaiting: vi.fn(), clients: { claim: vi.fn() } }, storage, fetchRequest, URL);
});
it('uses current navigation HTML and falls back to the offline connection page', async () => {
  const respondWith = vi.fn(); const request = { method: 'GET', url: 'https://grand-access.web.app/lgu-dashboard', mode: 'navigate' };
  fetchRequest.mockResolvedValueOnce('current-page'); handlers.get('fetch')!({ request, respondWith });
  expect(await respondWith.mock.lastCall![0]).toBe('current-page'); expect(storage.match).not.toHaveBeenCalled();
  fetchRequest.mockRejectedValueOnce(new Error('Offline')); handlers.get('fetch')!({ request, respondWith });
  expect(await respondWith.mock.lastCall![0]).toBe('offline-page'); expect(storage.match).toHaveBeenCalledWith('/offline.html');
});
it('does not intercept version checks or Firebase account requests', () => {
  const respondWith = vi.fn();
  for (const url of ['https://grand-access.web.app/version.json?t=1', 'https://firestore.googleapis.com/data', 'https://grand-access.web.app/api/account']) {
    handlers.get('fetch')!({ request: { method: 'GET', url, mode: 'cors' }, respondWith });
  }
  expect(respondWith).not.toHaveBeenCalled();
});
it('only removes old GrantAccess caches during activation', async () => {
  storage.keys.mockResolvedValueOnce(['unrelated-cache', 'grantaccess-static-old', 'grantaccess-static-__BUILD_ID__']);
  const waitUntil = vi.fn(); handlers.get('activate')!({ waitUntil }); await waitUntil.mock.lastCall![0];
  expect(storage.delete).toHaveBeenCalledExactlyOnceWith('grantaccess-static-old');
});
