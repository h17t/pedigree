import { useEffect, useId, useRef, useState } from 'react';
import { current } from 'immer';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';
import type { LifeStatus, Sex, UnionStatus } from '@/model/types';
import { useAppStore, transact, updateUi } from '@/store/store';
import { layoutAll } from '@/render/layout';
import { WIZARD_STEPS, applyWizard, clearDraft, emptyDraft, emptyPerson, hasName, loadDraft, saveDraft, summarize, yearValid } from '@/onboarding/wizard';
import type { WizardDraft, WizardPerson } from '@/onboarding/wizard';
import { useHints } from '@/onboarding/hints';
import { announce } from '../status';
import { useRouter } from '../router';

const SEXES: Sex[] = ['unknown', 'female', 'male', 'diverse'];
const STATUSES: UnionStatus[] = ['married', 'partnership', 'divorced', 'widowed', 'separated', 'unknown'];
const PARENT_STATUSES: UnionStatus[] = ['unknown', 'married', 'partnership', 'divorced', 'widowed', 'separated'];
const LIFE: LifeStatus[] = ['unknown', 'living', 'deceased'];
const STEP_KEYS = ['self', 'parents', 'partner', 'children'] as const;

/**
 * The guided start: four steps, each skippable, resumable (the draft is saved on every
 * change), and applied as ONE undo step through the ordinary edit functions.
 */
export function Wizard() {
  const { t } = useT();
  const go = useRouter((s) => s.go);
  const projectId = useAppStore((s) => s.projectId);
  const project = useAppStore((s) => s.project);
  const level = useAppStore((s) => s.ui.detailLevel);
  const [draft, setDraftState] = useState<WizardDraft>(() => {
    const d = loadDraft();
    return d && d.projectId === projectId ? d : emptyDraft(projectId ?? undefined);
  });
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const baseId = useId();

  const setDraft = (next: WizardDraft) => {
    setDraftState(next);
    saveDraft(next);
  };
  const stepTo = (step: WizardDraft['step']) => {
    setError(null);
    setDraft({ ...draft, step });
  };

  // Moving between steps moves focus to the step heading so keyboard and screen-reader
  // users know where they are.
  useEffect(() => {
    headingRef.current?.focus();
  }, [draft.step]);

  if (!project) return null;

  const validYears = (p: WizardPerson | null) => !p || (yearValid(p.birthYear) && (p.life !== 'deceased' || yearValid(p.deathYear)));
  const next = () => {
    if (draft.step === 0 && !hasName(draft.self)) {
      setError(t('wizard.selfRequired'));
      return;
    }
    const people = draft.step === 0 ? [draft.self] : draft.step === 1 ? [draft.father, draft.mother] : draft.step === 2 ? [draft.partner] : draft.children;
    if (!people.every(validYears) || (draft.step === 2 && draft.partner && !yearValid(draft.partner.marriageYear))) {
      setError(t('wizard.yearInvalid'));
      return;
    }
    if (draft.step < 3) stepTo((draft.step + 1) as WizardDraft['step']);
  };
  const skip = () => {
    if (draft.step === 1) setDraft({ ...draft, father: null, mother: null, step: 2 });
    else if (draft.step === 2) setDraft({ ...draft, partner: null, step: 3 });
    else if (draft.step === 3) setDraft({ ...draft, children: [] });
    setError(null);
  };
  const finish = () => {
    if (!hasName(draft.self)) {
      stepTo(0);
      setError(t('wizard.selfRequired'));
      return;
    }
    const all = [draft.self, draft.father, draft.mother, draft.partner, ...draft.children];
    if (!all.every(validYears) || (draft.partner && !yearValid(draft.partner.marriageYear))) {
      setError(t('wizard.yearInvalid'));
      return;
    }
    let selfId = '';
    const ok = transact(t('wizard.done'), (d) => {
      selfId = applyWizard(d, draft).selfId;
      const positions = layoutAll(current(d), level);
      for (const [id, pos] of positions) {
        const p = d.persons[id];
        if (p) p.position = pos;
      }
    });
    if (!ok) return;
    const { people } = summarize(draft);
    clearDraft();
    updateUi({ selectedPersonId: selfId, viewport: null, filter: null });
    useHints.getState().offer('addGrandparents');
    announce(t('wizard.doneMessage', { people: t('common.people', { count: people }) }));
    go('tree');
  };
  const leave = () => {
    saveDraft(draft);
    go(Object.keys(project.persons).length > 0 ? 'tree' : 'projects');
  };

  const summary = summarize(draft);
  const stepTitle = t(`wizard.steps.${STEP_KEYS[draft.step]}` as TKey);

  const personFields = (prefix: string, p: WizardPerson, onChange: (p: WizardPerson) => void, opts: { fixedSex?: boolean; legend?: string } = {}) => (
    <fieldset className="form-section wizard-person">
      {opts.legend && <legend>{opts.legend}</legend>}
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-given`}>{t('wizard.givenNames')}</label>
          <input id={`${prefix}-given`} className="input" value={p.givenNames} onChange={(e) => onChange({ ...p, givenNames: e.target.value })} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-surname`}>{t('wizard.surname')}</label>
          <input id={`${prefix}-surname`} className="input" value={p.surname} onChange={(e) => onChange({ ...p, surname: e.target.value })} autoComplete="off" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-year`}>{t('wizard.birthYear')}</label>
          <input id={`${prefix}-year`} className="input input-year" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={p.birthYear} onChange={(e) => onChange({ ...p, birthYear: e.target.value })} autoComplete="off" />
        </div>
        {!opts.fixedSex && (
          <div className="field">
            <label htmlFor={`${prefix}-sex`}>{t('wizard.sex')}</label>
            <select id={`${prefix}-sex`} className="select" value={p.sex} onChange={(e) => onChange({ ...p, sex: e.target.value as Sex })}>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {t(`person.sexValue.${s}` as TKey)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-life`}>{t('wizard.life')}</label>
          <select id={`${prefix}-life`} className="select" value={p.life} onChange={(e) => onChange({ ...p, life: e.target.value as LifeStatus })}>
            {LIFE.map((l) => (
              <option key={l} value={l}>
                {t(`wizard.lifeValue.${l}` as TKey)}
              </option>
            ))}
          </select>
        </div>
        {p.life === 'deceased' && (
          <div className="field">
            <label htmlFor={`${prefix}-death`}>{t('wizard.deathYear')}</label>
            <input id={`${prefix}-death`} className="input input-year" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={p.deathYear} onChange={(e) => onChange({ ...p, deathYear: e.target.value })} autoComplete="off" />
          </div>
        )}
      </div>
    </fieldset>
  );

  return (
    <div className="page wizard">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.step < 3) next();
          else finish();
        }}
      >
        <div className="stack-tight">
          <p className="hint tnum">{t('wizard.stepOf', { step: draft.step + 1, total: WIZARD_STEPS })}</p>
          <h1 ref={headingRef} tabIndex={-1} className="wizard-heading">
            {stepTitle}
          </h1>
          <ol className="wizard-progress" aria-hidden="true">
            {STEP_KEYS.map((k, i) => (
              <li key={k} className={i === draft.step ? 'wizard-progress-current' : i < draft.step ? 'wizard-progress-done' : ''} />
            ))}
          </ol>
          {draft.step === 0 && <p className="muted">{t('wizard.intro')}</p>}
          <p>{t(`wizard.${STEP_KEYS[draft.step]}Lead` as TKey)}</p>
        </div>

        {error && (
          <p className="notice notice-danger" role="alert">
            {error}
          </p>
        )}

        {draft.step === 0 && personFields(`${baseId}-self`, draft.self, (self) => setDraft({ ...draft, self }))}

        {draft.step === 1 && (
          <>
            {personFields(`${baseId}-father`, draft.father ?? emptyPerson('male'), (father) => setDraft({ ...draft, father }), { fixedSex: true, legend: t('wizard.father') })}
            {personFields(`${baseId}-mother`, draft.mother ?? emptyPerson('female'), (mother) => setDraft({ ...draft, mother }), { fixedSex: true, legend: t('wizard.mother') })}
            <div className="field">
              <label htmlFor={`${baseId}-parents-status`}>{t('wizard.parentsStatus')}</label>
              <select id={`${baseId}-parents-status`} className="select" value={draft.parentsStatus} onChange={(e) => setDraft({ ...draft, parentsStatus: e.target.value as UnionStatus })} aria-describedby={`${baseId}-parents-hint`}>
                {PARENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'unknown' ? t('wizard.statusNotRecorded') : t(`union.status.${s}` as TKey)}
                  </option>
                ))}
              </select>
              <p className="hint" id={`${baseId}-parents-hint`}>
                {t('wizard.parentsStatusHint')}
              </p>
            </div>
          </>
        )}

        {draft.step === 2 && (
          <>
            {personFields(`${baseId}-partner`, draft.partner ?? emptyPerson(), (p) => setDraft({ ...draft, partner: { marriageYear: '', status: 'married', ...draft.partner, ...p } }), { legend: t('wizard.partner') })}
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${baseId}-status`}>{t('wizard.status')}</label>
                <select
                  id={`${baseId}-status`}
                  className="select"
                  value={draft.partner?.status ?? 'married'}
                  onChange={(e) => setDraft({ ...draft, partner: { ...emptyPerson(), marriageYear: '', ...draft.partner, status: e.target.value as UnionStatus } })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'unknown' ? t('wizard.statusNotRecorded') : t(`union.status.${s}` as TKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${baseId}-marriage`}>{t('wizard.marriageYear')}</label>
                <input
                  id={`${baseId}-marriage`}
                  className="input input-year"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={draft.partner?.marriageYear ?? ''}
                  onChange={(e) => setDraft({ ...draft, partner: { ...emptyPerson(), status: 'married', ...draft.partner, marriageYear: e.target.value } })}
                  autoComplete="off"
                />
              </div>
            </div>
          </>
        )}

        {draft.step === 3 && (
          <>
            {draft.children.map((c, i) => (
              <div key={i} className="wizard-child">
                {personFields(`${baseId}-child-${i}`, c, (p) => setDraft({ ...draft, children: draft.children.map((x, j) => (j === i ? p : x)) }), { legend: t('wizard.child', { n: i + 1 }) })}
                <button type="button" className="btn btn-quiet" onClick={() => setDraft({ ...draft, children: draft.children.filter((_, j) => j !== i) })}>
                  {t('wizard.removeChild', { n: i + 1 })}
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn" onClick={() => setDraft({ ...draft, children: [...draft.children, emptyPerson()] })}>
                {t('wizard.addChild')}
              </button>
            </div>
            <section className="panel section" aria-labelledby={`${baseId}-summary`}>
              <h2 id={`${baseId}-summary`} className="wizard-summary-title">
                {t('wizard.summaryTitle')}
              </h2>
              <p>{summary.people === 0 ? t('wizard.summaryEmpty') : t('wizard.summary', { people: t('common.people', { count: summary.people }), unions: t('common.unions', { count: summary.unions }) })}</p>
            </section>
          </>
        )}

        <div className="btn-row wizard-actions">
          {draft.step > 0 && (
            <button type="button" className="btn" onClick={() => stepTo((draft.step - 1) as WizardDraft['step'])}>
              {t('common.back')}
            </button>
          )}
          {draft.step > 0 && draft.step < 3 && (
            <button type="button" className="btn" onClick={skip}>
              {t('wizard.skip')}
            </button>
          )}
          {draft.step < 3 ? (
            <button type="submit" className="btn btn-primary">
              {t('wizard.next')}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary">
              {t('wizard.finish')}
            </button>
          )}
        </div>
        <div className="stack-tight">
          <button type="button" className="link-btn" onClick={leave}>
            {t('wizard.leave')}
          </button>
          <p className="hint">{t('wizard.leaveHint')}</p>
        </div>
      </form>
    </div>
  );
}
