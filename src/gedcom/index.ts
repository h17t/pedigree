/** Lazy entry point for the GEDCOM module. */
export { importGedcomBytes, importGedcomText } from './toModel';
export type { ImportResult } from './toModel';
export { exportGedcom } from './fromModel';
export type { ExportOptions } from './fromModel';
export type { ImportReport, ExportReport } from './report';
export { decodeGedcom } from './decode';
export { parseGedcomDate, formatGedcomDate } from './dates';
