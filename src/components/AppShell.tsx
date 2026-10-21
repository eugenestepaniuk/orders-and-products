'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { dictionary } from '@/shared/i18n';
import { requestJson } from '@/shared/api';
import type { Locale } from '@/shared/types';
import { useInventoryConnection } from '@/hooks/useInventoryConnection';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { refreshInventory } from '@/store/store';
import { TopMenu } from './TopMenu';
import { Icon } from './Icon';
import { PwaFeatures } from './PwaFeatures';

export function AppShell({
  children,
  locale,
  username,
}: {
  children: React.ReactNode;
  locale: Locale;
  username: string;
}) {
  const t = dictionary(locale);
  const path = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const error = useAppSelector((state) => state.inventory.error);
  const loading = useAppSelector((state) => state.inventory.status === 'loading');
  useInventoryConnection(locale);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const updateInert = () => {
      if (navigationRef.current) navigationRef.current.inert = !media.matches && !menuOpen;
    };
    const closeOnDesktop = () => {
      updateInert();
      if (media.matches) setMenuOpen(false);
    };
    updateInert();
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.classList.add('navigation-open');
    const links = () =>
      Array.from(
        navigationRef.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') ?? [],
      );
    links()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = links();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.classList.remove('navigation-open');
      document.removeEventListener('keydown', trap);
      document.getElementById('navigation-toggle')?.focus();
    };
  }, [menuOpen]);

  async function logout() {
    setLeaving(true);
    setLogoutFailed(false);
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
      router.replace(`/${locale}/login`);
      router.refresh();
    } catch {
      setLogoutFailed(true);
      setLeaving(false);
    }
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t.skip}
      </a>
      <TopMenu locale={locale} onMenu={() => setMenuOpen(!menuOpen)} menuOpen={menuOpen} />
      {menuOpen && (
        <button
          className="navigation__backdrop"
          aria-label={t.close}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="navigation-menu"
        ref={navigationRef}
        className={`navigation ${menuOpen ? 'navigation--open' : ''}`}
        aria-label={t.navigation}
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen || undefined}
      >
        <div className="navigation__profile">
          <div className="navigation__avatar" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="40" fill="#dce6e8" />
              <circle cx="40" cy="29" r="14" fill="#8aa2aa" />
              <path d="M13 76c0-33 54-33 54 0" fill="#8aa2aa" />
            </svg>
          </div>
          <span>{username}</span>
        </div>
        <nav className="navigation__links">
          {(
            [
              ['orders', t.orders],
              ['products', t.products],
              ['analytics', t.analytics],
            ] as const
          ).map(([route, label]) => (
            <Link
              key={route}
              href={`/${locale}/${route}`}
              className={`navigation__link ${path.endsWith(`/${route}`) ? 'navigation__link--active' : ''}`}
              aria-current={path.endsWith(`/${route}`) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="navigation__logout"
          disabled={leaving}
          onClick={() => {
            void logout();
          }}
        >
          <Icon name="logout" size={17} />
          {t.logout}
        </button>
        {logoutFailed && (
          <p className="navigation__error" role="alert">
            {t.network_error}
          </p>
        )}
      </aside>
      <main id="main-content" className="workspace" tabIndex={-1}>
        {(error || logoutFailed) && (
          <div className="notice notice--error" role="alert">
            <span>{error ? t[error] : t.network_error}</span>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                void dispatch(refreshInventory());
              }}
            >
              {t.retry}
            </button>
          </div>
        )}
        <div className="workspace__progress" aria-hidden="true" data-loading={loading} />
        {children}
        <PwaFeatures locale={locale} />
      </main>
    </div>
  );
}
