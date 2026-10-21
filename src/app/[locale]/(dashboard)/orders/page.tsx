import { notFound } from 'next/navigation';
import { isLocale } from '@/shared/i18n';
import { OrdersPage } from '@/features/orders/OrdersPage';

export const metadata = { title: 'Orders' };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <OrdersPage locale={locale} />;
}
