import { useId, useState } from 'react';
import { useT } from '@/i18n';
import type { DateQualifier, PartialDate } from '@/model/types';
import { formatDateWithQualifier, formatPartialDate, isRange, parseUserDate } from '@/model/dates';
import type { ParsedDate } from '@/model/dates';
import { useSettings } from '@/store/settings';

/**
 * A date text field that accepts both conventions and keyword sets, always echoes the
 * interpretation in plain language ("Understood as: 2 March 1923"), and offers the other
 * reading in one click when the input is ambiguous.
 */
export function DateField({ id, label, value, qualifier, dateEnd = null, onChange, hint }: { id: string; label: string; value: PartialDate; qualifier: DateQualifier; dateEnd?: PartialDate; onChange: (v: ParsedDate) => void; hint?: string }) {
  const { t, locale } = useT();
  const dateFormat = useSettings((s) => s.dateFormat);
  const formatted = formatDateWithQualifier(locale, value, qualifier, 'short', dateEnd);
  const [text, setText] = useState(formatted);
  const [alternative, setAlternative] = useState<ParsedDate | null>(null);
  const [bad, setBad] = useState(false);
  // Remember which stored value the text belongs to; when it changes from outside (the
  // alternative reading was chosen, or the locale switched), refresh the text during render.
  const [seen, setSeen] = useState(formatted);
  if (seen !== formatted) {
    setSeen(formatted);
    setText(formatted);
    setAlternative(null);
    setBad(false);
  }
  const echoId = useId();

  const commit = (s: string) => {
    setText(s);
    if (s.trim() === '') {
      setBad(false);
      setAlternative(null);
      onChange({ date: null, qualifier: 'exact', dateEnd: null });
      return;
    }
    const r = parseUserDate(s, dateFormat);
    if (r.ok) {
      setBad(false);
      setAlternative(r.alternative);
      if (r.value.date !== value || r.value.qualifier !== qualifier || r.value.dateEnd !== dateEnd) {
        // Keep what the user typed; only the echo updates.
        setSeen(formatDateWithQualifier(locale, r.value.date, r.value.qualifier, 'short', r.value.dateEnd));
        onChange(r.value);
      }
    } else {
      setBad(true);
      setAlternative(null);
    }
  };

  const echo = value
    ? t('dates.understoodAs', {
        date: isRange(qualifier) ? formatDateWithQualifier(locale, value, qualifier, 'long', dateEnd) : `${qualifier !== 'exact' ? `${t(`dates.qualifierLong.${qualifier}`)} ` : ''}${formatPartialDate(locale, value, 'long')}`,
      })
    : '';

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="text" inputMode="text" value={text} onChange={(e) => commit(e.target.value)} aria-describedby={echoId} aria-invalid={bad || undefined} autoComplete="off" />
      <div id={echoId} className={bad ? 'field-error' : 'hint'} aria-live="polite">
        {bad ? (dateFormat === 'dayFirst' ? t('dates.unreadable') : t('dates.unreadableMonthFirst')) : echo || hint || `${t('edit.yearHint')} ${t('dates.rangeHint')}`}
        {!bad && alternative && (
          <>
            {' '}
            <button type="button" className="link-btn" onClick={() => onChange(alternative)}>
              {t('dates.readAsInstead', { date: formatDateWithQualifier(locale, alternative.date, alternative.qualifier, 'long') })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
