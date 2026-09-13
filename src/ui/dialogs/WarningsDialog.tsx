import { useT } from '@/i18n';
import { updateUi, useAppStore } from '@/store/store';
import { personName } from '@/model/types';
import { Dialog } from '../components/Dialog';
import { warningText } from '../warnings';
import { closeEditor } from '../edit/editorStore';
import { useRouter } from '../router';

/** The full list of things to check, each with a button that shows the person. */
export function WarningsDialog() {
  const { t } = useT();
  const warnings = useAppStore((s) => s.warnings);
  const project = useAppStore((s) => s.project)!;
  const go = useRouter((s) => s.go);
  const mode = useRouter((s) => s.mode);
  return (
    <Dialog open title={t('warnings.title')} onClose={closeEditor}>
      <div className="stack">
        {warnings.length === 0 ? (
          <p>{t('warnings.none')}</p>
        ) : (
          <ul className="warning-list">
            {warnings.map((w, i) => {
              const p = project.persons[w.personIds[0]!];
              return (
                <li key={i} className="notice notice-warn">
                  <p>{warningText(t, w)}</p>
                  {p && (
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          updateUi({ selectedPersonId: p.id });
                          if (mode === 'data' || mode === 'projects') go('list');
                          closeEditor();
                        }}
                      >
                        {t('warnings.showPerson', { name: personName(p) || t('person.unnamed') })}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
