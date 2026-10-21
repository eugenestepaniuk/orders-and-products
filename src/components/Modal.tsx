'use client';

import { useId, useLayoutEffect, useRef } from 'react';
import { Icon } from './Icon';

export function Modal({
  title,
  description,
  closeLabel,
  onClose,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    document.body.classList.add('has-dialog');
    return () => {
      // Close before React removes the dialog so the browser can restore focus.
      dialog?.close();
      document.body.classList.remove('has-dialog');
    };
  }, []);
  return (
    <dialog
      className={`dialog ${className}`}
      ref={ref}
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog__close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <h2 id={id} className="dialog__title">
        {title}
      </h2>
      {description && (
        <p id={`${id}-description`} className="visually-hidden">
          {description}
        </p>
      )}
      {children}
    </dialog>
  );
}
