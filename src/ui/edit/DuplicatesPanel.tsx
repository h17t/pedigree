import { useMemo } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { personName } from '@/model/types';
import { useAppStore } from '@/store/store';
import { findDuplicates } from '@/model/duplicates';
import { cardText } from '@/render/geometry';
import { openEditor } from './editorStore';

/** "Possible duplicates" list, available at any time. */
export function DuplicatesPanel() {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project)!;
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  const pairs = useMemo(() => findDuplicates(project), [project]);
  const label = (id: string) => {
    const p = project.persons[id]!;
    return `${personName(p) || t('person.unnamed')} (${cardText(p, 'minimal', locale).lines[0] || t('dates.unknownDate')})`;
  };
  return (
    <section className="panel section" aria-labelledby="sec-dupes">
      <h3 id="sec-dupes">{t('edit.duplicates')}</h3>
      <p>{t('edit.duplicatesIntro')}</p>
      {pairs.length === 0 ? (
        <p className="muted">{t('edit.duplicatesNone')}</p>
      ) : (
        <ul className="link-list">
          {pairs.map((d) => (
            <li key={`${d.aId}-${d.bId}`} className="dupe-row">
              <span>
                {label(d.aId)} · {label(d.bId)}
                <span className="hint"> {d.reasons.map((r) => t(`edit.duplicateReason.${r}` as TKey)).join(', ')}</span>
              </span>
              {!readOnly && (
                <button type="button" className="btn" onClick={() => openEditor({ kind: 'merge', aId: d.aId, bId: d.bId })}>
                  {t('edit.compare')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
