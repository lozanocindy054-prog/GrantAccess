import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAutomaticUpdates } from './automaticUpdateService';
const stops: Array<() => void> = [];
const response = (version: string) => ({ ok: true, json: async () => ({ version }) });
const flush = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { stops.splice(0).forEach(stop => stop()); document.body.innerHTML = ''; vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('automatic app updates', () => {
  it('does not reload an unchanged version', async () => {
    const fetchVersion = vi.fn().mockResolvedValue(response('build1')); const reload = vi.fn();
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, reload, isSafeToReload: () => true }));
    await flush(); expect(reload).not.toHaveBeenCalled();
    expect(fetchVersion).toHaveBeenCalledWith(expect.stringContaining('/version.json?t='), expect.objectContaining({ cache: 'no-store' }));
  });
  it('waits for pending writes and reloads only once', async () => {
    let finish!: () => void;
    const writes = new Promise<void>(resolve => { finish = resolve; });
    const reload = vi.fn(); const fetchVersion = vi.fn().mockResolvedValue(response('build2'));
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, reload, beforeReload: () => writes, isSafeToReload: () => true }));
    await flush(); expect(reload).not.toHaveBeenCalled(); finish(); await flush(); expect(reload).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(60_000); expect(reload).toHaveBeenCalledOnce();
  });
  it('preserves an edited field until it is cleared or saved', async () => {
    const input = document.createElement('input'); input.type = 'text'; document.body.appendChild(input);
    vi.spyOn(input, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    const reload = vi.fn(); const fetchVersion = vi.fn().mockResolvedValue(response('build2'));
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, reload }));
    input.focus(); input.value = 'Unsaved application'; input.blur(); await flush(); expect(reload).not.toHaveBeenCalled();
    input.value = ''; window.dispatchEvent(new Event('focus')); await flush(); expect(reload).toHaveBeenCalledOnce();
  });
  it('rechecks editing safety after waiting for a save', async () => {
    let finish!: () => void; let safe = true;
    const writes = new Promise<void>(resolve => { finish = resolve; }); const reload = vi.fn();
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion: vi.fn().mockResolvedValue(response('build2')), reload, beforeReload: () => writes, isSafeToReload: () => safe }));
    await flush(); safe = false; finish(); await flush(); expect(reload).not.toHaveBeenCalled();
    safe = true; window.dispatchEvent(new Event('focus')); await flush(); expect(reload).toHaveBeenCalledOnce();
  });
  it('checks when a hidden tab becomes visible again', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const fetchVersion = vi.fn().mockResolvedValue(response('build1'));
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, isSafeToReload: () => true }));
    await flush(); expect(fetchVersion).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); await flush(); expect(fetchVersion).toHaveBeenCalledOnce();
  });
  it('ignores temporary failures and retries when online', async () => {
    const fetchVersion = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(response('build2')); const reload = vi.fn();
    stops.push(startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, reload, isSafeToReload: () => true }));
    await flush(); expect(reload).not.toHaveBeenCalled(); window.dispatchEvent(new Event('online')); await flush(); expect(reload).toHaveBeenCalledOnce();
  });
  it('ignores invalid manifest responses and cleans up its timers', async () => {
    const fetchVersion = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unrelated: 'value' }) }); const reload = vi.fn();
    const stop = startAutomaticUpdates({ currentVersion: 'build1', versionUrl: '/version.json', fetchVersion, reload, isSafeToReload: () => true }); stops.push(stop);
    await flush(); stop(); window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchVersion).toHaveBeenCalledOnce(); expect(reload).not.toHaveBeenCalled();
  });
});
