import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SESSION_COOKIE, verifyToken } from '@/server/auth';
import { isLocale } from '@/shared/i18n';
import { LoginForm } from '@/features/auth/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await verifyToken((await cookies()).get(SESSION_COOKIE)?.value))
    redirect(`/${locale}/orders`);
  return <LoginForm locale={locale} />;
}
