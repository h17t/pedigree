/**
 * GEDCOM actions used by the Data view. The GEDCOM module is loaded lazily; importing as a
 * new project runs the full layout, merge-import is one undo step and places the new people.
 */
import type { ImportReport, ExportReport } from '@/gedcom/report';
import { t } from '@/i18n';
import { layoutAll, placeUnpositioned } from '@/render/layout';
import { adoptProject } from './projects';
import { withoutPrivate } from '@/model/privacy';
import { transact, useAppStore, markBackedUp } from './store';

export type GedcomImportOutcome =
  | { ok: true; mode: 'new'; id: string; name: string; report: ImportReport }
  | { ok: true; mode: 'merge'; added: number; report: ImportReport }
  | { ok: false; reason: 'empty' | 'unreadable' | 'quota' | 'readOnly' };

function nameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || t('projects.newName');
}

export async function importGedcomAsNew(bytes: Uint8Array, fileName: string, preserve: boolean): Promise<GedcomImportOutcome> {
  const { importGedcomBytes } = await import('@/gedcom');
  const r = importGedcomBytes(bytes, preserve);
  if (!r.ok) return r;
  const positions = layoutAll(r.project, 'standard');
  for (const [id, pos] of positions) r.project.persons[id]!.position = pos;
  const name = nameFromFile(fileName);
  const a = adoptProject(r.project, name);
  if (!a.ok) return { ok: false, reason: 'quota' };
  return { ok: true, mode: 'new', id: a.id, name, report: r.report };
}

export async function importGedcomMerge(bytes: Uint8Array, preserve: boolean): Promise<GedcomImportOutcome> {
  const { importGedcomBytes } = await import('@/gedcom');
  const s = useAppStore.getState();
  if (!s.project || s.lockState !== 'owner') return { ok: false, reason: 'readOnly' };
  const r = importGedcomBytes(bytes, preserve);
  if (!r.ok) return r;
  const incoming = r.project;
  const added = Object.keys(incoming.persons).length;
  const ok = transact(t('gedcom.importButton'), (d) => {
    for (const p of Object.values(incoming.persons)) d.persons[p.id] = p;
    for (const u of Object.values(incoming.unions)) d.unions[u.id] = u;
    for (const l of Object.values(incoming.childLinks)) d.childLinks[l.id] = l;
    if (preserve) d.rawRecords.push(...incoming.rawRecords);
    // Place the newcomers into free space, as one step with the import.
    const placement = placeUnpositioned(d, 'standard');
    for (const id of placement.provisional) {
      const p = d.persons[id];
      if (p) p.position = placement.positions.get(id) ?? null;
    }
  });
  if (!ok) return { ok: false, reason: 'readOnly' };
  return { ok: true, mode: 'merge', added, report: r.report };
}

export async function exportGedcomFile(hidePrivate = true): Promise<{ file: string; report: ExportReport } | null> {
  const s = useAppStore.getState();
  if (!s.project) return null;
  const { exportGedcom } = await import('@/gedcom');
  const source = hidePrivate ? withoutPrivate(s.project) : s.project;
  const { text, report } = exportGedcom(source, { preserve: s.project.settings.preserveRawGedcom, sourceName: 'Pedigree', sourceVersion: __APP_VERSION__ });
  report.privateOmitted = Object.keys(s.project.persons).length - Object.keys(source.persons).length;
  const safe = s.project.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tree';
  const file = `${t('gedcom.filePrefix')}-${safe}-${new Date().toISOString().slice(0, 10)}.ged`;
  const blob = new Blob([text], { type: 'text/vnd.familysearch.gedcom;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  markBackedUp();
  return { file, report };
}

/** Bytes of preserved raw GEDCOM data in the open project (UTF-16 storage estimate). */
export function rawDataBytes(): number {
  const p = useAppStore.getState().project;
  if (!p) return 0;
  let n = p.rawRecords.reduce((a, r) => a + r.length, 0);
  for (const x of Object.values(p.persons)) n += x.rawGedcom.reduce((a, r) => a + r.length, 0);
  for (const x of Object.values(p.unions)) n += x.rawGedcom.reduce((a, r) => a + r.length, 0);
  return n * 2;
}

export function removeRawData(): void {
  transact(t('gedcom.rawRemove'), (d) => {
    d.rawRecords = [];
    for (const p of Object.values(d.persons)) p.rawGedcom = [];
    for (const u of Object.values(d.unions)) u.rawGedcom = [];
  });
}

export function setPreserveRaw(on: boolean): void {
  transact(t('gedcom.preserve'), (d) => {
    d.settings.preserveRawGedcom = on;
  });
}
