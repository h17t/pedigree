import { useEffect } from 'react';
import { useT } from '@/i18n';
import { redoLast, undoLast, useAppStore } from '@/store/store';
import { announce } from '../status';

/** Visible Undo/Redo buttons (also Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y). */
export function UndoRedo({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const undoLabel = useAppStore((s) => s.undoLabel);
  const redoLabel = useAppStore((s) => s.redoLabel);
  const readOnly = useAppStore((s) => s.lockState !== 'owner');

  const undo = () => {
    if (!undoLabel) return;
    undoLast();
    announce(t('edit.undone', { label: undoLabel }));
  };
  const redo = () => {
    if (!redoLabel) return;
    redoLast();
    announce(t('edit.redone', { label: redoLabel }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (readOnly) return null;
  return (
    <div className="btn-row undo-redo" role="group" aria-label={`${t('common.undo')} / ${t('common.redo')}`}>
      <button type="button" className={`btn ${compact ? 'btn-compact' : ''}`} onClick={undo} disabled={!canUndo} title={undoLabel ? t('edit.undoLabel', { label: undoLabel }) : t('edit.nothingToUndo')}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
        </svg>
        <span>{t('common.undo')}</span>
      </button>
      <button type="button" className={`btn ${compact ? 'btn-compact' : ''}`} onClick={redo} disabled={!canRedo} title={redoLabel ? t('edit.redoLabel', { label: redoLabel }) : t('edit.nothingToRedo')}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9a5 5 0 0 0 0 10h3" />
        </svg>
        <span>{t('common.redo')}</span>
      </button>
    </div>
  );
}
