import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';

/**
 * Modal dialog on the native <dialog> element: focus trapping, Escape and the backdrop come
 * for free and are announced correctly by screen readers.
 */
export function Dialog({ open, title, onClose, children, describedBy, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; describedBy?: string; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Two dialogs can be mounted at once (the projects page keeps rename and delete side by side),
  // so the heading that labels the dialog needs an id of its own.
  const titleId = useId();
  const { t } = useT();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog${wide ? ' dialog-wide' : ''}`} onClose={onClose} aria-labelledby={titleId} aria-describedby={describedBy}>
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
