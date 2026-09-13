import type { ValidationWarning } from '@/model/validation';
import type { TKey, TParams } from '@/i18n';

/** Phrase a validation warning in the active language. */
export function warningText(t: (k: TKey, p?: TParams) => string, w: ValidationWarning): string {
  return t(`warnings.${w.code}` as TKey, w.params);
}
