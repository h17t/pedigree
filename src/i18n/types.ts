import type { en, PluralForms } from './en';
export type { Locale } from './locales';

/**
 * Structural type of the dictionary: every leaf becomes `string` or `PluralForms` so that
 * the other languages can be typed against the shape of `en` without identical values.
 */
type Widen<T> = T extends string
  ? string
  : T extends { one: string; other: string }
    ? PluralForms
    : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;

/** All dotted key paths that end in a leaf, e.g. 'projects.title'. */
type Leaf = string | PluralForms;
type PathsOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${P}${K}` : PathsOf<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = PathsOf<Dictionary>;

export type DateFormat = 'dayFirst' | 'monthFirst';
export type TParams = Record<string, string | number>;
