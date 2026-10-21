import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SESSION_COOKIE, verifyToken } from '@/server/auth';
import { getInventory } from '@/server/inventory';
import { EMPTY_INVENTORY } from '@/shared/types';
import { isLocale } from '@/shared/i18n';
import { InventoryProvider } from '@/store/InventoryProvider';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/${locale}/login`);
  let inventory = EMPTY_INVENTORY;
  let failed = false;
  try {
    inventory = await getInventory();
  } catch {
    failed = true;
  }
  return (
    <InventoryProvider initialInventory={inventory} initialError={failed ? 'unavailable' : null}>
      <AppShell locale={locale} username={session.username}>
        {children}
      </AppShell>
    </InventoryProvider>
  );
}
