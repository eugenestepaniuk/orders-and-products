'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { dictionary } from '@/shared/i18n';
import type { Locale } from '@/shared/types';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
function subscribeNetwork(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
const onlineSnapshot = () => navigator.onLine;
const serverSnapshot = () => true;

export function PwaFeatures({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const online = useSyncExternalStore(subscribeNetwork, onlineSnapshot, serverSnapshot);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  return (
    <div className="pwa-action">
      {!online && (
        <p className="notice" role="status">
          {t.offline}
        </p>
      )}
      {prompt && (
        <button
          className="button button--secondary"
          onClick={() => {
            void install();
          }}
        >
          {t.installApp}
        </button>
      )}
    </div>
  );
}
