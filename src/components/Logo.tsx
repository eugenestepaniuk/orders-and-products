import Link from 'next/link';
import type { Locale } from '@/shared/types';

export function Logo({ locale }: { locale: Locale }) {
  return (
    <Link className="brand" href={`/${locale}/orders`} aria-label="Inventory">
      <svg viewBox="0 0 40 48" width="34" height="42" aria-hidden="true">
        <path fill="#80b53f" d="M20 0 39 7v18c0 11-9 19-19 23C10 44 1 36 1 25V7Z" />
        <path fill="#66982d" d="M20 7 33 12v13c0 7-5 13-13 17Z" />
        <circle cx="20" cy="21" r="6" fill="white" />
        <path d="M10 35c0-11 20-11 20 0Z" fill="white" />
      </svg>
      <span>Inventory</span>
    </Link>
  );
}
