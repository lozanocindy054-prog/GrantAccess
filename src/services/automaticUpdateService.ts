interface UpdateOptions {
  currentVersion: string;
  versionUrl: string;
  intervalMs?: number;
  fetchVersion?: typeof fetch;
  beforeReload?: () => Promise<void>;
  isSafeToReload?: () => boolean;
  reload?: () => void;
}
const EDITABLE = 'input,textarea,select,[contenteditable="true"],ion-input,ion-textarea,ion-select,ion-checkbox,ion-toggle';
const controlValue = (element: HTMLElement): string => {
  if (element instanceof HTMLInputElement && element.type === 'file') return Array.from(element.files || [], file => `${file.name}:${file.size}`).join('|');
  if ((element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) || element.matches('ion-checkbox,ion-toggle')) return String((element as HTMLInputElement).checked);
  const value = (element as HTMLInputElement).value;
  return JSON.stringify(value ?? element.textContent ?? '');
};
const isVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected || !element.getClientRects().length) return false;
  let candidate: Element = element;
  while (true) {
    if (candidate.closest('.ion-page-hidden,.ion-page-invisible,[aria-hidden="true"]')) return false;
    const root = candidate.getRootNode();
    if (!(root instanceof ShadowRoot)) break;
    candidate = root.host;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

export const startAutomaticUpdates = (options: UpdateOptions): (() => void) => {
  const fetchVersion = options.fetchVersion || window.fetch.bind(window);
  const reload = options.reload || (() => window.location.reload());
  const editedControls = new Map<HTMLElement, string>();
  let stopped = false;
  let checking = false;
  let applying = false;
  let pendingVersion = '';
  let activeRequest: AbortController | undefined;
  const captureBaseline = (event: Event) => {
    const path = event.composedPath();
    const ionic = path.find(item => item instanceof HTMLElement && item.matches('ion-input,ion-textarea,ion-select,ion-checkbox,ion-toggle'));
    const element = ionic || path.find(item => item instanceof HTMLElement && item.matches(EDITABLE));
    if (element instanceof HTMLElement && !editedControls.has(element)) editedControls.set(element, controlValue(element));
  };
  const safe = () => {
    if (options.isSafeToReload) return options.isSafeToReload();
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches(EDITABLE)) return false;
    for (const [element, baseline] of editedControls) {
      if (!isVisible(element)) { editedControls.delete(element); continue; }
      if (controlValue(element) !== baseline) return false;
    }
    if (Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).some(input => isVisible(input) && input.files?.length)) return false;
    if (Array.from(document.querySelectorAll('video')).some(video => isVisible(video) && video.srcObject)) return false;
    return !Array.from(document.querySelectorAll<HTMLElement>('ion-spinner,[aria-busy="true"]')).some(isVisible);
  };
  const check = async () => {
    if (stopped || checking || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    checking = true;
    const request = new AbortController();
    activeRequest = request;
    const timeout = window.setTimeout(() => request.abort(), 5000);
    try {
      const separator = options.versionUrl.includes('?') ? '&' : '?';
      const response = await fetchVersion(`${options.versionUrl}${separator}t=${Date.now()}`, { cache: 'no-store', signal: request.signal });
      if (response.ok) {
        const data: unknown = await response.json();
        if (data && typeof data === 'object' && 'version' in data && typeof data.version === 'string' && data.version.length > 0 && data.version.length <= 100) {
          pendingVersion = data.version === options.currentVersion ? '' : data.version;
        }
      }
    } catch { /* Offline, old hosting releases, and temporary network errors do not interrupt the app. */ }
    finally { window.clearTimeout(timeout); activeRequest = undefined; checking = false; }
    if (stopped || applying || !pendingVersion || !safe()) return;
    applying = true;
    try {
      await options.beforeReload?.();
      if (!stopped && document.visibilityState === 'visible' && safe()) { stop(); reload(); }
    } catch { /* A pending save or authentication change will be retried on the next check. */ }
    finally { applying = false; }
  };
  const trigger = () => { void check(); };
  const timer = window.setInterval(trigger, options.intervalMs || 30_000);
  const baselineEvents = ['focusin', 'pointerdown', 'beforeinput', 'ionFocus'];
  baselineEvents.forEach(name => document.addEventListener(name, captureBaseline, true));
  window.addEventListener('focus', trigger);
  window.addEventListener('online', trigger);
  document.addEventListener('visibilitychange', trigger);
  function stop() {
    if (stopped) return;
    stopped = true; window.clearInterval(timer); activeRequest?.abort(); editedControls.clear();
    baselineEvents.forEach(name => document.removeEventListener(name, captureBaseline, true));
    window.removeEventListener('focus', trigger); window.removeEventListener('online', trigger); document.removeEventListener('visibilitychange', trigger);
  }
  trigger();
  return stop;
};
