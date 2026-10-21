'use client';

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export function Field({
  label,
  error,
  wrapperClassName = '',
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  wrapperClassName?: string;
}) {
  const generated = useId();
  const id = props.id || generated;
  return (
    <div className={`field ${wrapperClassName}`}>
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        className={`field__input ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
