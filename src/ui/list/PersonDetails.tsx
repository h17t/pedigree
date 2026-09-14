import type { Person, Project } from '@/model/types';
import { displayName, effectiveLifeStatus } from '@/model/types';
import { formatDateWithQualifier } from '@/model/dates';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import { buildAdjacency, breakCycles } from '@/model/graph';
import { useAppStore } from '@/store/store';
import { warningText } from '../warnings';

/** Read-only detail panel for one person: all fields, relations and the warnings about them. */
export function PersonDetails({ project, person, onSelect, relations = true, section = 'all' }: { project: Project; person: Person; onSelect: (id: string) => void; relations?: boolean; section?: 'all' | 'header' | 'fields' }) {
  const { t, locale } = useT();
  const warnings = useAppStore((s) => s.warnings).filter((w) => w.personIds[0] === person.id);
  const adj = buildAdjacency(project, breakCycles(project).ignoredLinks);
  const status = effectiveLifeStatus(person);
  const group = person.groupId ? project.groups.find((g) => g.id === person.groupId) : undefined;
  const name = (id: string) => {
    const p = project.persons[id];
    return p ? displayName(p, t('person.née')) || t('person.unnamed') : t('common.unknown');
  };
  const date = (d: string | null, q: Person['birth']['qualifier']) => (d ? formatDateWithQualifier(locale, d, q, 'long') : t('dates.unknownDate'));

  const parentUnions = adj.parentLinks.get(person.id) ?? [];
  const partnerUnions = (adj.partnerUnions.get(person.id) ?? []).map((id) => project.unions[id]!).filter(Boolean);
  const siblings = new Set<string>();
  for (const l of parentUnions) for (const s of adj.unionChildren.get(l.unionId) ?? []) if (s.childId !== person.id) siblings.add(s.childId);

  // Plain render helper (not a component), so it does not remount on every render.
  const field = (label: string, value: string, key?: string) =>
    value ? (
      <div className="detail-field" key={key ?? label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ) : null;

  return (
    <div className="details">
      {section !== 'fields' && (
        <>
      <h2 className="details-name">{displayName(person, t('person.née')) || t('person.unnamed')}</h2>
      <p className="muted tnum">
        {person.birth.date || person.death.date
          ? `${person.birth.date ? `* ${formatDateWithQualifier(locale, person.birth.date, person.birth.qualifier)}` : ''}${person.death.date ? ` † ${formatDateWithQualifier(locale, person.death.date, person.death.qualifier)}` : ''}`.trim()
          : t('dates.unknownDate')}
      </p>
      {group && (
        <p>
          <span className={`tag tag-${group.color}`}>{group.name || t(`edit.tagColors.${group.color}` as TKey)}</span>
        </p>
      )}
      {warnings.length > 0 && (
        <section className="notice notice-warn" aria-label={t('warnings.title')}>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{warningText(t, w)}</li>
            ))}
          </ul>
        </section>
      )}
        </>
      )}
      {section !== 'header' && (
        <>
      <dl className="detail-list">
        {field(t('person.givenNames'), person.givenNames)}
        {field(t('person.surname'), person.surname)}
        {field(t('person.birthName'), person.birthName)}
        {field(t('person.nickname'), person.nickname)}
        {field(t('person.titlePrefix'), person.titlePrefix)}
        {field(t('person.sex'), t(`person.sexValue.${person.sex}` as TKey))}
        {field(t('person.birth'), [date(person.birth.date, person.birth.qualifier), person.birth.place].filter(Boolean).join(', '))}
        {field(t('person.note'), person.birth.note)}
        {field(t('person.lifeStatus'), t(`person.lifeStatusValue.${status}` as TKey))}
        {person.death.date && field(t('person.death'), [date(person.death.date, person.death.qualifier), person.death.place].filter(Boolean).join(', '))}
        {field(t('person.cause'), person.death.cause)}
        {field(t('person.occupation'), person.occupation)}
        {field(t('person.religion'), person.religion)}
        {field(t('person.residence'), person.residence)}
        {person.events.length > 0 && (
          <div className="detail-field">
            <dt>{t('person.events')}</dt>
            <dd>
              <ul>
                {person.events.map((e) => (
                  <li key={e.id}>
                    {e.type === 'other' ? e.label : t(`person.eventType.${e.type}` as TKey)}
                    {e.date ? `: ${formatDateWithQualifier(locale, e.date, e.qualifier, 'long')}` : ''}
                    {e.place ? `, ${e.place}` : ''}
                    {e.note ? ` (${e.note})` : ''}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {person.customFields.map((f, i) => field(f.label, f.value, `custom-${i}`))}
        {field(t('person.sources'), person.sources)}
        {field(t('person.notes'), person.notes)}
      </dl>

      {relations && (
        <>
      <section className="detail-relations" aria-label={t('person.parents')}>
        <h3>{t('person.parents')}</h3>
        {parentUnions.length === 0 ? (
          <p className="muted">{t('person.noParents')}</p>
        ) : (
          <ul className="link-list">
            {parentUnions.map((l) => {
              const u = project.unions[l.unionId]!;
              return u.partnerIds.length === 0 ? (
                <li key={l.id} className="muted">
                  {t('union.partnersUnknown')}
                  {l.relationType !== 'biological' ? ` (${t(`person.relation.${l.relationType}` as TKey)})` : ''}
                </li>
              ) : (
                u.partnerIds.map((pid) => (
                  <li key={l.id + pid}>
                    <button type="button" className="link-btn" onClick={() => onSelect(pid)}>
                      {name(pid)}
                    </button>
                    {l.relationType !== 'biological' ? ` (${t(`person.relation.${l.relationType}` as TKey)})` : ''}
                  </li>
                ))
              );
            })}
          </ul>
        )}
      </section>

      <section className="detail-relations" aria-label={t('person.partners')}>
        <h3>{t('person.partners')}</h3>
        {partnerUnions.length === 0 ? (
          <p className="muted">{t('person.noPartners')}</p>
        ) : (
          <ul className="link-list">
            {partnerUnions.map((u) => {
              const others = u.partnerIds.filter((p) => p !== person.id);
              const info = [
                t(`union.type.${u.type}` as TKey),
                t(`union.status.${u.status}` as TKey),
                u.marriageDate ? `${t('union.marriageDate')}: ${formatDateWithQualifier(locale, u.marriageDate, u.marriageQualifier)}` : '',
                u.divorceDate ? `${t('union.divorceDate')}: ${formatDateWithQualifier(locale, u.divorceDate, u.divorceQualifier)}` : '',
              ]
                .filter(Boolean)
                .join(' · ');
              const kids = (adj.unionChildren.get(u.id) ?? []).map((l) => l.childId);
              return (
                <li key={u.id}>
                  {others.length === 0 ? (
                    <span className="muted">{t('common.unknown')}</span>
                  ) : (
                    others.map((pid) => (
                      <button key={pid} type="button" className="link-btn" onClick={() => onSelect(pid)}>
                        {name(pid)}
                      </button>
                    ))
                  )}
                  <span className="muted small"> {info}</span>
                  {kids.length > 0 && (
                    <ul className="link-list link-list-nested">
                      {kids.map((k) => (
                        <li key={k}>
                          <button type="button" className="link-btn" onClick={() => onSelect(k)}>
                            {name(k)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="detail-relations" aria-label={t('person.siblings')}>
        <h3>{t('person.siblings')}</h3>
        {siblings.size === 0 ? (
          <p className="muted">{t('common.none')}</p>
        ) : (
          <ul className="link-list">
            {[...siblings].map((s) => (
              <li key={s}>
                <button type="button" className="link-btn" onClick={() => onSelect(s)}>
                  {name(s)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      )}
        </>
      )}
    </div>
  );
}
