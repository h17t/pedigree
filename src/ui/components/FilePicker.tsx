import { useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useT } from '@/i18n';

/**
 * A labelled button that opens the file chooser, plus drag-and-drop on its surrounding zone.
 * The button is the primary route; drop is an enhancement.
 */
export function FilePicker({ label, hint, onText, accept = '.json,application/json', primary = false }: { label: string; hint?: string; onText: (text: string, fileName: string) => void; accept?: string; primary?: boolean }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();
  const read = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((text) => onText(text, file.name))
      .catch(() => onText('', file.name));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    read(e.dataTransfer.files[0]);
  };
  return (
    // The drop handlers are an enhancement for pointer users; the labelled button inside is
    // the accessible route, so the zone itself needs no interactive role.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`drop-zone${over ? ' drop-zone-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          read(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className={primary ? 'btn btn-primary' : 'btn'} onClick={() => input.current?.click()} aria-describedby={hint ? hintId : undefined}>
        {label}
      </button>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      <p className="hint drop-hint">{t('data.dropHere')}</p>
    </div>
  );
}
