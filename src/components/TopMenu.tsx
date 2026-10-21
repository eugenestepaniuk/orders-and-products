'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { searchChanged } from '@/store/store';
import { dictionary } from '@/shared/i18n';
import type { Locale } from '@/shared/types';
import { Icon } from './Icon';
import { Logo } from './Logo';

function subscribeClock(listener: () => void) {
  const interval = setInterval(listener, 1000);
  return () => clearInterval(interval);
}
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => 0;

export function TopMenu({
  locale,
  onMenu,
  menuOpen,
}: {
  locale: Locale;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const t = dictionary(locale);
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const search = useAppSelector((state) => state.ui.search);
  const count = useAppSelector((state) => state.ui.sessions);
  const connected = useAppSelector((state) => state.ui.connected);
  const now = useSyncExternalStore(subscribeClock, snapshot, serverSnapshot);
  const date = now ? new Date(now) : null;
  const other = locale === 'ru' ? 'en' : 'ru';
  return (
    <header className="top-menu">
      <div className="top-menu__brand">
        <Logo locale={locale} />
      </div>
      <button
        id="navigation-toggle"
        className="icon-button top-menu__toggle"
        type="button"
        onClick={onMenu}
        aria-label={t.openMenu}
        aria-expanded={menuOpen}
        aria-controls="navigation-menu"
      >
        <Icon name="menu" />
      </button>
      <div className="top-menu__search">
        <Icon name="search" size={17} />
        <label className="visually-hidden" htmlFor="inventory-search">
          {t.search}
        </label>
        <input
          id="inventory-search"
          type="search"
          placeholder={t.search}
          value={search}
          onChange={(event) => dispatch(searchChanged(event.target.value))}
          autoComplete="off"
        />
      </div>
      <div className="top-menu__clock">
        <span>
          {date ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date) : '…'}
        </span>
        <div>
          <time dateTime={date?.toISOString()}>
            {date
              ? new Intl.DateTimeFormat(locale, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }).format(date)
              : '…'}
          </time>
          <Icon name="clock" size={17} />
          <span className="top-menu__time">
            {date
              ? new Intl.DateTimeFormat(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                }).format(date)
              : '…'}
          </span>
        </div>
      </div>
      <span
        className={`sessions ${connected ? 'sessions--connected' : ''}`}
        title={connected ? t.connected : t.reconnecting}
      >
        <span className="sessions__dot" />
        <span className="visually-hidden">{t.sessions}: </span>
        <span data-testid="session-count" aria-live="polite">
          {count ?? '—'}
        </span>
      </span>
      <Link
        className="top-menu__language"
        href={pathname.replace(/^\/(ru|en)/, `/${other}`)}
        hrefLang={other}
        aria-label={t.language}
      >
        {other.toUpperCase()}
      </Link>
    </header>
  );
}
