/**
 * Display order of personal names: given names first (most languages) or surname first
 * (Korean, Japanese, Chinese by default, or by the user's choice). Read by `personName`;
 * set by the settings store. Kept out of the i18n module so the model stays independent.
 */
import { create } from 'zustand';

export const useNameOrder = create<{ surnameFirst: boolean }>(() => ({ surnameFirst: false }));

export function setSurnameFirst(surnameFirst: boolean): void {
  if (useNameOrder.getState().surnameFirst !== surnameFirst) useNameOrder.setState({ surnameFirst });
}

const CJK = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}ー・]+$/u;

/** Join surname and given names in the active order; CJK-only names join without a space. */
export function joinName(givenNames: string, surname: string): string {
  const g = givenNames.trim(), s = surname.trim();
  if (!g || !s) return g || s;
  const first = useNameOrder.getState().surnameFirst;
  const noSpace = CJK.test(g) && CJK.test(s);
  return first ? (noSpace ? `${s}${g}` : `${s} ${g}`) : noSpace ? `${g}${s}` : `${g} ${s}`;
}
