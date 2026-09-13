/** Import/export report structures. Phrased by the UI in the active language. */
import type { ValidationWarning } from '@/model/validation';
import type { Encoding } from './decode';

export interface ImportReport {
  individuals: number;
  families: number;
  childLinks: number;
  encodingDeclared: string | null;
  encodingDetected: Encoding;
  encodingMismatch: boolean;
  gedcomVersion: string | null;
  sourceProgram: string | null;
  /** Tags not mapped to the model, with counts; they are preserved when preservation is on. */
  ignoredTags: Record<string, number>;
  preservedRecords: number;
  preservedLines: number;
  /** Dates interpreted with uncertainty: person/family label + original value. */
  uncertainDates: { where: string; value: string; interpretedAs: string }[];
  /** Structural problems found while reading. */
  problems: string[];
  /** Missing references (CHIL/HUSB/WIFE pointing nowhere). */
  danglingReferences: number;
  warnings: ValidationWarning[];
  notes: ('sexXAsDiverse' | 'marnmAsSurname' | 'noteRecordsInlined' | 'multipleNames')[];
}

export interface ExportReport {
  individuals: number;
  families: number;
  preserved: boolean;
  preservedRecords: number;
  preservedLines: number;
  notes: ('diverseAsX' | 'customFieldsAsUdf' | 'sameSexAsHusbWife' | 'preservationOff' | 'rangesVerbatim')[];
}
