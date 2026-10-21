'use client';

import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';

export function Modal({
  title,
  closeLabel,
  onClose,
  children,
  className = '',
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    document.body.classList.add('has-dialog');
    return () => {
      dialog?.close();
      document.body.classList.remove('has-dialog');
    };
  }, []);
  return (
    <dialog
      className={`dialog ${className}`}
      ref={ref}
      aria-labelledby={id}
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
      {children}
    </dialog>
  );
}
