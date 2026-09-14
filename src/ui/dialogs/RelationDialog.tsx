import { useState } from 'react';
import { useT } from '@/i18n';
import { displayName } from '@/model/types';
import { useAppStore } from '@/store/store';
import { describeRelation } from '@/model/relationship';
import { Dialog } from '../components/Dialog';
import { closeEditor } from '../edit/editorStore';
import { searchPersons } from '../list/outline';

/** "How are A and B related?" with a name search for B and a plain-language answer. */
export function RelationDialog({ aId }: { aId: string }) {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project)!;
  const [query, setQuery] = useState('');
  const [bId, setBId] = useState<string | null>(null);
  const a = project.persons[aId];
  if (!a) return null;
  const name = (id: string) => {
    const p = project.persons[id];
    return p ? displayName(p, t('person.née')) || t('person.unnamed') : t('common.unknown');
  };
  const matches = query.trim() ? searchPersons(project, query).filter((id) => id !== aId).slice(0, 8) : [];
  return (
    <Dialog open title={t('relation.title', { name: name(aId) })} onClose={closeEditor}>
      <div className="stack">
        {bId && project.persons[bId] && (
          <p className="notice notice-info relation-result" role="status">
            {describeRelation(project, aId, bId, t, locale, name)}
          </p>
        )}
        <div className="field">
          <label htmlFor="relation-search">{t('relation.pick')}</label>
          <input id="relation-search" className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <ul className="link-list">
          {matches.map((id) => (
            <li key={id}>
              <button type="button" className="btn btn-block" onClick={() => setBId(id)}>
                {name(id)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
