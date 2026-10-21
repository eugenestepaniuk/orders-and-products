'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { dictionary } from '@/shared/i18n';
import { orderInputSchema } from '@/shared/validation';
import { RequestError, requestJson } from '@/shared/api';
import type { ApiCode, Locale } from '@/shared/types';

export function OrderForm({
  locale,
  onClose,
  onSaved,
}: {
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = dictionary(locale);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiCode | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parsed = orderInputSchema.safeParse(values);
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
      await requestJson('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      onSaved();
    } catch (failure) {
      setError(failure instanceof RequestError ? failure.code : 'unavailable');
      setPending(false);
    }
  }
  return (
    <Modal
      title={t.addOrder}
      closeLabel={t.close}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="record-form"
        onSubmit={(event) => {
          void submit(event);
        }}
        noValidate
      >
        <Field
          label={t.title}
          name="title"
          required
          maxLength={160}
          error={errors.title}
          disabled={pending}
          autoFocus
        />
        <Field
          label={t.date}
          name="date"
          type="date"
          required
          error={errors.date}
          disabled={pending}
        />
        <div className="field">
          <label htmlFor="order-description">{t.description}</label>
          <textarea
            id="order-description"
            name="description"
            maxLength={1000}
            rows={3}
            disabled={pending}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {t[error]}
          </p>
        )}
        <div className="dialog__actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            {t.cancel}
          </button>
          <button className="button" disabled={pending}>
            {pending ? t.saving : t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
