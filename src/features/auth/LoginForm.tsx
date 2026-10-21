'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { dictionary } from '@/shared/i18n';
import { loginSchema } from '@/shared/validation';
import { requestJson, RequestError } from '@/shared/api';
import type { ApiCode, Locale } from '@/shared/types';

export function LoginForm({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiCode | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), t.required])),
      );
      const first = form.elements.namedItem(String(parsed.error.issues[0]?.path[0]));
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setErrors({});
    setError(null);
    setPending(true);
    try {
      await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      router.replace(`/${locale}/orders`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof RequestError ? failure.code : 'unavailable');
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-card">
        <Logo locale={locale} />
        <h1>{t.loginTitle}</h1>
        <p>{t.loginHint}</p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
        >
          <Field
            label={t.username}
            name="username"
            autoComplete="username"
            maxLength={60}
            required
            error={errors.username}
            disabled={pending}
          />
          <Field
            label={t.password}
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            error={errors.password}
            disabled={pending}
          />
          {error && (
            <p className="form-error" role="alert">
              {t[error]}
            </p>
          )}
          <button className="button login-card__submit" disabled={pending}>
            {pending ? t.signingIn : t.signIn}
          </button>
        </form>
        <Link className="login-card__language" href={`/${locale === 'ru' ? 'en' : 'ru'}/login`}>
          {locale === 'ru' ? 'English' : 'Русский'}
        </Link>
      </div>
    </main>
  );
}
