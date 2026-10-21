import { notFound } from 'next/navigation';
import { isLocale } from '@/shared/i18n';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';

export const metadata = { title: 'Analytics' };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AnalyticsPage locale={locale} />;
}
