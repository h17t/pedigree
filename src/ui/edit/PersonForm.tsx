import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { LifeEvent, Person, Sex, LifeStatus } from '@/model/types';
import { newId, personName } from '@/model/types';
import { useAppStore, transact } from '@/store/store';
import { DateField } from './DateField';
import { announce } from '../status';

const SEXES: Sex[] = ['female', 'male', 'diverse', 'unknown'];
const STATUSES: LifeStatus[] = ['unknown', 'living', 'deceased'];
const EVENT_TYPES: LifeEvent['type'][] = ['baptism', 'burial', 'residence', 'emigration', 'other'];

/**
 * The person editor. Works on a local copy and writes one undo step on save. A death date
 * forces "deceased" and disables the status control with an explanation.
 */
export function PersonForm({ person, isNew, onDone, onDelete }: { person: Person; isNew: boolean; onDone: () => void; onDelete: () => void }) {
  const groups = useAppStore((s) => s.project?.groups ?? []);
  const { t } = useT();
  const [p, setP] = useState<Person>(() => structuredClone(person));
  const firstField = useRef<HTMLInputElement>(null);
  // A brand-new person starts in the name field so typing can begin at once.
  useEffect(() => {
    if (isNew) firstField.current?.focus();
  }, [isNew]);
  const set = <K extends keyof Person>(k: K, v: Person[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const hasDeathDate = !!p.death.date;

  const save = () => {
    const name = personName(p) || t('person.unnamed');
    const next: Person = { ...p, lifeStatus: p.death.date ? 'deceased' : p.lifeStatus, events: p.events.filter((e) => e.type !== 'other' || e.label.trim() || e.date || e.place), customFields: p.customFields.filter((f) => f.label.trim() || f.value.trim()) };
    transact(isNew ? t('edit.addedPerson', { what: t('edit.what.person') }) : t('edit.editLabel', { name }), (d) => {
      d.persons[next.id] = next;
    });
    announce(t('edit.saved'));
    onDone();
  };

  return (
    <form
      className="person-form stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2>{isNew ? t('edit.newPersonTitle') : t('edit.editTitle')}</h2>

      <fieldset className="form-section">
        <legend>{t('edit.sectionName')}</legend>
        <div className="field">
          <label htmlFor="pf-given">{t('person.givenNames')}</label>
          <input ref={firstField} id="pf-given" className="input" value={p.givenNames} onChange={(e) => set('givenNames', e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-surname">{t('person.surname')}</label>
          <input id="pf-surname" className="input" value={p.surname} onChange={(e) => set('surname', e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-birthname">{t('person.birthName')}</label>
          <input id="pf-birthname" className="input" value={p.birthName} onChange={(e) => set('birthName', e.target.value)} autoComplete="off" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="pf-nick">{t('person.nickname')}</label>
            <input id="pf-nick" className="input" value={p.nickname} onChange={(e) => set('nickname', e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="pf-title">{t('person.titlePrefix')}</label>
            <input id="pf-title" className="input" value={p.titlePrefix} onChange={(e) => set('titlePrefix', e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-sex">{t('person.sex')}</label>
          <select id="pf-sex" className="select" value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {t(`person.sexValue.${s}` as TKey)}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('edit.sectionBirth')}</legend>
        <DateField id="pf-birth" label={t('person.date')} value={p.birth.date} qualifier={p.birth.qualifier} onChange={(v) => set('birth', { ...p.birth, ...v })} />
        <div className="field">
          <label htmlFor="pf-birthplace">{t('person.place')}</label>
          <input id="pf-birthplace" className="input" value={p.birth.place} onChange={(e) => set('birth', { ...p.birth, place: e.target.value })} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-birthnote">{t('person.note')}</label>
          <input id="pf-birthnote" className="input" value={p.birth.note} onChange={(e) => set('birth', { ...p.birth, note: e.target.value })} autoComplete="off" />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('edit.sectionLife')}</legend>
        <div className="field">
          <label htmlFor="pf-status">{t('person.lifeStatus')}</label>
          <select id="pf-status" className="select" value={hasDeathDate ? 'deceased' : p.lifeStatus} disabled={hasDeathDate} onChange={(e) => set('lifeStatus', e.target.value as LifeStatus)} aria-describedby={hasDeathDate ? 'pf-status-hint' : undefined}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`person.lifeStatusValue.${s}` as TKey)}
              </option>
            ))}
          </select>
          {hasDeathDate && (
            <p className="hint" id="pf-status-hint">
              {t('person.deathForcesDeceased')}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="pf-occupation">{t('person.occupation')}</label>
          <input id="pf-occupation" className="input" value={p.occupation} onChange={(e) => set('occupation', e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-residence">{t('person.residence')}</label>
          <input id="pf-residence" className="input" value={p.residence} onChange={(e) => set('residence', e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-religion">{t('person.religion')}</label>
          <input id="pf-religion" className="input" value={p.religion} onChange={(e) => set('religion', e.target.value)} autoComplete="off" />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('edit.sectionDeath')}</legend>
        <DateField id="pf-death" label={t('person.date')} value={p.death.date} qualifier={p.death.qualifier} onChange={(v) => set('death', { ...p.death, ...v })} />
        <div className="field">
          <label htmlFor="pf-deathplace">{t('person.place')}</label>
          <input id="pf-deathplace" className="input" value={p.death.place} onChange={(e) => set('death', { ...p.death, place: e.target.value })} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-cause">{t('person.cause')}</label>
          <input id="pf-cause" className="input" value={p.death.cause} onChange={(e) => set('death', { ...p.death, cause: e.target.value })} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="pf-deathnote">{t('person.note')}</label>
          <input id="pf-deathnote" className="input" value={p.death.note} onChange={(e) => set('death', { ...p.death, note: e.target.value })} autoComplete="off" />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('edit.sectionEvents')}</legend>
        {p.events.map((ev, i) => (
          <div key={ev.id} className="event-row panel">
            <div className="field">
              <label htmlFor={`ev-type-${ev.id}`}>{t('edit.eventLabel')}</label>
              <select id={`ev-type-${ev.id}`} className="select" value={ev.type} onChange={(e) => set('events', p.events.map((x, j) => (j === i ? { ...x, type: e.target.value as LifeEvent['type'] } : x)))}>
                {EVENT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`person.eventType.${ty}` as TKey)}
                  </option>
                ))}
              </select>
            </div>
            {ev.type === 'other' && (
              <div className="field">
                <label htmlFor={`ev-label-${ev.id}`}>{t('edit.customLabel')}</label>
                <input id={`ev-label-${ev.id}`} className="input" value={ev.label} onChange={(e) => set('events', p.events.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} autoComplete="off" />
              </div>
            )}
            <DateField id={`ev-date-${ev.id}`} label={t('person.date')} value={ev.date} qualifier={ev.qualifier} onChange={(v) => set('events', p.events.map((x, j) => (j === i ? { ...x, ...v } : x)))} />
            <div className="field">
              <label htmlFor={`ev-place-${ev.id}`}>{t('person.place')}</label>
              <input id={`ev-place-${ev.id}`} className="input" value={ev.place} onChange={(e) => set('events', p.events.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)))} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`ev-note-${ev.id}`}>{t('person.note')}</label>
              <input id={`ev-note-${ev.id}`} className="input" value={ev.note} onChange={(e) => set('events', p.events.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} autoComplete="off" />
            </div>
            <button type="button" className="btn btn-danger" onClick={() => set('events', p.events.filter((_, j) => j !== i))}>
              {t('edit.removeEvent')}
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set('events', [...p.events, { id: newId(), type: 'baptism', label: '', date: null, qualifier: 'exact', place: '', note: '' }])}>
          {t('edit.addEvent')}
        </button>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('edit.sectionMore')}</legend>
        <div className="field">
          <label htmlFor="pf-sources">{t('person.sources')}</label>
          <textarea id="pf-sources" className="textarea" value={p.sources} onChange={(e) => set('sources', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pf-notes">{t('person.notes')}</label>
          <textarea id="pf-notes" className="textarea" value={p.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        {p.customFields.map((f, i) => (
          <div key={i} className="field-row custom-row">
            <div className="field">
              <label htmlFor={`cf-label-${i}`}>{t('edit.customLabel')}</label>
              <input id={`cf-label-${i}`} className="input" value={f.label} onChange={(e) => set('customFields', p.customFields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`cf-value-${i}`}>{t('edit.customValue')}</label>
              <input id={`cf-value-${i}`} className="input" value={f.value} onChange={(e) => set('customFields', p.customFields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} autoComplete="off" />
            </div>
            <button type="button" className="btn btn-quiet" onClick={() => set('customFields', p.customFields.filter((_, j) => j !== i))}>
              {t('edit.removeCustomField')}
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set('customFields', [...p.customFields, { label: '', value: '' }])}>
          {t('edit.addCustomField')}
        </button>
        <div className="field">
          <label htmlFor="pf-group">{t('person.tag')}</label>
          <select id="pf-group" className="select" value={p.groupId ?? ''} onChange={(e) => set('groupId', e.target.value || null)} aria-describedby="pf-group-hint">
            <option value="">{t('edit.tagNone')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || t(`edit.tagColors.${g.color}` as TKey)}
              </option>
            ))}
          </select>
          <p className="hint" id="pf-group-hint">
            {t('edit.groupHint')}
          </p>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-block">
          {t('edit.saveChanges')}
        </button>
      </div>
      <div className="form-secondary">
        <div className="btn-row">
          <button type="button" className="btn" onClick={onDone}>
            {isNew ? t('common.cancel') : t('edit.discard')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            {t('edit.deletePerson')}
          </button>
        </div>
      </div>
    </form>
  );
}
