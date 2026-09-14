import { useStatus } from '../status';
import { useT, formatDateTime } from '@/i18n';

/** One quiet row with the newest message, plus an optional log of the last ones. */
export function StatusMessages() {
  const current = useStatus((s) => s.current);
  const log = useStatus((s) => s.log);
  const logOpen = useStatus((s) => s.logOpen);
  const dismiss = useStatus((s) => s.dismiss);
  const toggleLog = useStatus((s) => s.toggleLog);
  const clearLog = useStatus((s) => s.clearLog);
  const { t, locale } = useT();
  return (
    <div className="status-region">
      <div role="status" aria-live="polite" className={current ? `status-row status-${current.kind}` : 'status-row status-empty'}>
        {current && (
          <>
            <span className="status-text">{current.text}</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => dismiss(current.id)}>
              {t('common.dismiss')}
            </button>
          </>
        )}
        {log.length > 1 && (
          <button type="button" className="btn btn-quiet btn-sm" aria-expanded={logOpen} onClick={toggleLog}>
            {t('status.log', { count: log.length })}
          </button>
        )}
      </div>
      {logOpen && (
        <div className="status-log panel">
          <ul>
            {log.map((m) => (
              <li key={m.id} className={`status-log-item status-${m.kind}`}>
                <span className="hint tnum">{formatDateTime(locale, m.at)}</span> {m.text}
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <button type="button" className="btn btn-sm" onClick={clearLog}>
              {t('status.clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
