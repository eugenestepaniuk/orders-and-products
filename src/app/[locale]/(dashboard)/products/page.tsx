import { notFound } from 'next/navigation';
import { isLocale } from '@/shared/i18n';
import { ProductsPage } from '@/features/products/ProductsPage';

export const metadata = { title: 'Products' };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ProductsPage locale={locale} />;
}
