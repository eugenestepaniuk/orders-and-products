'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { dictionary } from '@/shared/i18n';
import { productInputSchema } from '@/shared/validation';
import { parseMoney } from '@/shared/format';
import { requestJson, RequestError } from '@/shared/api';
import type { ApiCode, Locale, Order } from '@/shared/types';

export function ProductForm({
  locale,
  orders,
  orderId,
  onClose,
  onSaved,
}: {
  locale: Locale;
  orders: Order[];
  orderId?: number;
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
    const parsed = productInputSchema.safeParse({
      title: values.title,
      type: values.type,
      serialNumber: values.serialNumber,
      orderId: Number(values.orderId),
      isNew: values.isNew === 'on',
      warrantyStart: values.warrantyStart,
      warrantyEnd: values.warrantyEnd,
      usdMinor: parseMoney(String(values.usdMinor)),
      uahMinor: parseMoney(String(values.uahMinor)),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.path[0] === 'warrantyEnd' ? t.warrantyInvalid : t.required,
          ]),
        ),
      );
      const first = form.elements.namedItem(String(parsed.error.issues[0]?.path[0]));
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setErrors({});
    setError(null);
    setPending(true);
    try {
      await requestJson('/api/products', {
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
      title={t.addProduct}
      closeLabel={t.close}
      onClose={() => {
        if (!pending) onClose();
      }}
      className="dialog--wide"
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
        <div className="row gx-3">
          <Field
            label={t.type}
            wrapperClassName="col-12 col-sm-6"
            name="type"
            required
            maxLength={60}
            error={errors.type}
            disabled={pending}
          />
          <Field
            label={t.serialNumber}
            wrapperClassName="col-12 col-sm-6"
            name="serialNumber"
            required
            maxLength={80}
            error={errors.serialNumber}
            disabled={pending}
          />
        </div>
        <div className="field">
          <label htmlFor="product-order">{t.order}</label>
          <select
            id="product-order"
            name="orderId"
            defaultValue={orderId ?? orders[0]?.id}
            disabled={pending}
          >
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.title}
              </option>
            ))}
          </select>
        </div>
        <div className="row gx-3">
          <Field
            label={t.warrantyStart}
            wrapperClassName="col-12 col-sm-6"
            name="warrantyStart"
            type="date"
            required
            error={errors.warrantyStart}
            disabled={pending}
          />
          <Field
            label={t.warrantyEnd}
            wrapperClassName="col-12 col-sm-6"
            name="warrantyEnd"
            type="date"
            required
            error={errors.warrantyEnd}
            disabled={pending}
          />
        </div>
        <div className="row gx-3">
          <Field
            label={`${t.price}, USD`}
            wrapperClassName="col-12 col-sm-6"
            name="usdMinor"
            inputMode="decimal"
            required
            error={errors.usdMinor}
            disabled={pending}
          />
          <Field
            label={`${t.price}, UAH`}
            wrapperClassName="col-12 col-sm-6"
            name="uahMinor"
            inputMode="decimal"
            required
            error={errors.uahMinor}
            disabled={pending}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="isNew" defaultChecked disabled={pending} />
          {t.new}
        </label>
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
