import { useEffect, useState } from 'react';
import './AppInstallButton.css';
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const installed = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const AppInstallButton = () => {
  const [isInstalled, setInstalled] = useState(installed);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState('');
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setInstructions(''); };
    const complete = () => { setInstalled(true); setPrompt(null); setInstructions(''); };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const change = () => setInstalled(installed());
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', complete);
    displayMode.addEventListener?.('change', change);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', complete);
      displayMode.removeEventListener?.('change', change);
    };
  }, []);
  const install = async () => {
    if (busy) return;
    if (!prompt) {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setInstructions(ios ? 'In Safari, tap Share, then Add to Home Screen and Add.' : 'Open your browser menu and choose Install GrantAccess or Add to Home screen. If unavailable, open this site in Chrome, Edge, or Safari.');
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } catch { setInstructions('Use your browser menu to install GrantAccess or add it to your home screen.'); }
    finally { setPrompt(null); setBusy(false); }
  };
  if (isInstalled) return null;
  return <div className="app-install"><button className="app-install-button" type="button" disabled={busy} onClick={() => void install()}>{busy ? 'Opening installer?' : 'Install app'}</button><span>Add GrantAccess to your home screen.</span>{instructions && <p role="status">{instructions}</p>}</div>;
};
export default AppInstallButton;
