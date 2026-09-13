import { useRef, useState } from 'react';
import { useT, formatBytes, formatNumber } from '@/i18n';
import type { TKey } from '@/i18n';
import type { ImportReport, ExportReport } from '@/gedcom/report';
import { useAppStore, openProject } from '@/store/store';
import { exportGedcomFile, importGedcomAsNew, importGedcomMerge, rawDataBytes, removeRawData, setPreserveRaw } from '@/store/gedcomActions';
import { Dialog } from '../components/Dialog';
import { announce } from '../status';
import { useRouter } from '../router';
import { openEditor } from '../edit/editorStore';

/** Data view section: GEDCOM import (new or merge) and export, with reports. */
export function GedcomPanel() {
  const { t, locale } = useT();
  const go = useRouter((s) => s.go);
  const project = useAppStore((s) => s.project)!;
  const readOnly = useAppStore((s) => s.lockState !== 'owner');
  const [mode, setMode] = useState<'new' | 'merge'>('new');
  const [preserve, setPreserve] = useState(true);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ kind: 'import'; report: ImportReport } | { kind: 'export'; report: ExportReport } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const rawBytes = rawDataBytes();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = mode === 'new' || readOnly ? await importGedcomAsNew(bytes, file.name, preserve) : await importGedcomMerge(bytes, preserve);
      if (!r.ok) {
        const msg = r.reason === 'gedcom7' ? t('gedcom.gedcom7', { version: r.version ?? '7' }) : r.reason === 'empty' ? t('gedcom.empty') : r.reason === 'quota' ? t('data.storageFull') : r.reason === 'readOnly' ? t('edit.readOnly') : t('gedcom.unreadable');
        announce(msg, 'danger');
        return;
      }
      if (r.mode === 'new') {
        announce(t('gedcom.imported', { people: t('common.people', { count: r.report.individuals }), file: file.name }));
        openProject(r.id);
      } else announce(t('gedcom.mergedImport', { people: t('common.people', { count: r.added }), file: file.name }));
      setReport({ kind: 'import', report: r.report });
    } finally {
      setBusy(false);
    }
  };
  const onExport = async () => {
    const r = await exportGedcomFile();
    if (!r) return;
    announce(t('gedcom.exported', { file: r.file }));
    setReport({ kind: 'export', report: r.report });
  };

  return (
    <section className="panel section" aria-labelledby="sec-gedcom">
      <h3 id="sec-gedcom">{t('gedcom.title')}</h3>
      <p>{t('gedcom.intro')}</p>
      <fieldset className="form-section">
        <legend>{t('gedcom.importButton')}</legend>
        <p className="hint">{t('gedcom.importHint')}</p>
        <div className="radio-row">
          <input id="ged-mode-new" type="radio" name="ged-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
          <label htmlFor="ged-mode-new">{t('gedcom.modeNew')}</label>
        </div>
        <div className="radio-row">
          <input id="ged-mode-merge" type="radio" name="ged-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} disabled={readOnly} aria-describedby="ged-mode-merge-hint" />
          <span>
            <label htmlFor="ged-mode-merge">{t('gedcom.modeMerge')}</label>
            <span className="hint" id="ged-mode-merge-hint">
              {t('gedcom.modeMergeHint')}
            </span>
          </span>
        </div>
        <div className="radio-row">
          <input id="ged-preserve" type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} aria-describedby="ged-preserve-hint" />
          <span>
            <label htmlFor="ged-preserve">{t('gedcom.preserve')}</label>
            <span className="hint" id="ged-preserve-hint">
              {t('gedcom.preserveHint')}
            </span>
          </span>
        </div>
        <input
          ref={input}
          type="file"
          accept=".ged,.gedcom,text/plain,application/octet-stream"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? t('gedcom.importing') : t('gedcom.importButton')}
          </button>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>{t('gedcom.exportButton')}</legend>
        <p className="hint">{t('gedcom.exportHint')}</p>
        {!readOnly && (
          <div className="radio-row">
            <input id="ged-keep" type="checkbox" checked={project.settings.preserveRawGedcom} onChange={(e) => setPreserveRaw(e.target.checked)} aria-describedby="ged-keep-hint" />
            <span>
              <label htmlFor="ged-keep">{t('gedcom.preserve')}</label>
              <span className="hint" id="ged-keep-hint">
                {t('gedcom.preserveHint')}
              </span>
            </span>
          </div>
        )}
        {rawBytes > 0 && (
          <div className="btn-row">
            <span className="tnum">{t('gedcom.rawStored', { size: formatBytes(locale, rawBytes) })}</span>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  removeRawData();
                  announce(t('gedcom.rawRemoved'));
                }}
              >
                {t('gedcom.rawRemove')}
              </button>
            )}
          </div>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => void onExport()}>
            {t('gedcom.exportButton')}
          </button>
        </div>
      </fieldset>

      {report && (
        <Dialog open title={report.kind === 'import' ? t('gedcom.reportTitle') : t('gedcom.exportReportTitle')} onClose={() => setReport(null)}>
          <div className="stack report">
            {report.kind === 'import' ? <ImportReportBody r={report.report} onShowWarnings={() => { setReport(null); openEditor({ kind: 'warnings' }); }} onShowDuplicates={() => setReport(null)} /> : <ExportReportBody r={report.report} />}
            <div className="btn-row btn-row-end">
              <button type="button" className="btn btn-primary" onClick={() => setReport(null)}>
                {t('gedcom.close')}
              </button>
              {report.kind === 'import' && (
                <button type="button" className="btn" onClick={() => { setReport(null); go('tree'); }}>
                  {t('nav.tree')}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

const NOTE_KEYS: Record<string, TKey> = {
  sexXAsDiverse: 'gedcom.noteSexX', marnmAsSurname: 'gedcom.noteMarnm', noteRecordsInlined: 'gedcom.noteNotesInlined', multipleNames: 'gedcom.noteMultipleNames',
  diverseAsX: 'gedcom.noteDiverseAsX', customFieldsAsUdf: 'gedcom.noteUdf', sameSexAsHusbWife: 'gedcom.noteSameSex', preservationOff: 'gedcom.notePreservationOff', rangesVerbatim: 'gedcom.noteRanges',
};

function ImportReportBody({ r, onShowWarnings }: { r: ImportReport; onShowWarnings: () => void; onShowDuplicates: () => void }) {
  const { t, locale } = useT();
  const ignored = Object.entries(r.ignoredTags).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <dl className="detail-list">
        <div className="detail-field"><dt>{t('gedcom.people')}</dt><dd className="tnum">{formatNumber(locale, r.individuals)}</dd></div>
        <div className="detail-field"><dt>{t('gedcom.families')}</dt><dd className="tnum">{formatNumber(locale, r.families)}</dd></div>
        <div className="detail-field"><dt>{t('gedcom.childLinks')}</dt><dd className="tnum">{formatNumber(locale, r.childLinks)}</dd></div>
        <div className="detail-field"><dt>{t('gedcom.encoding')}</dt><dd>{t('gedcom.encodingLine', { declared: r.encodingDeclared ?? t('gedcom.encodingNone'), detected: r.encodingDetected })}</dd></div>
        {r.sourceProgram && <div className="detail-field"><dt>{t('gedcom.program')}</dt><dd>{r.sourceProgram}</dd></div>}
        {r.gedcomVersion && <div className="detail-field"><dt>{t('gedcom.version')}</dt><dd>{r.gedcomVersion}</dd></div>}
      </dl>
      {r.encodingMismatch && <p className="notice notice-warn">{t('gedcom.encodingMismatch', { detected: r.encodingDetected })}</p>}
      {ignored.length > 0 && (
        <div className="stack-tight">
          <p className="field-label">{t('gedcom.ignored')}</p>
          <p className="small">{ignored.map(([tag, n]) => `${tag} (${formatNumber(locale, n)})`).join(', ')}</p>
          <p className="hint">{r.preservedLines > 0 ? t('gedcom.ignoredKept') : t('gedcom.ignoredDropped')}</p>
        </div>
      )}
      {r.preservedRecords > 0 && <p>{t('gedcom.preservedRecords', { count: r.preservedRecords })}</p>}
      {r.uncertainDates.length > 0 && (
        <div className="stack-tight">
          <p className="field-label">{t('gedcom.uncertainDates')}</p>
          <ul className="small">
            {r.uncertainDates.slice(0, 50).map((u, i) => (
              <li key={i}>{t('gedcom.uncertainLine', { where: u.where, value: u.value, as: u.interpretedAs })}</li>
            ))}
            {r.uncertainDates.length > 50 && <li>…</li>}
          </ul>
        </div>
      )}
      {r.problems.length > 0 && (
        <div className="stack-tight">
          <p className="field-label">{t('gedcom.problems')}</p>
          <ul className="small">
            {r.problems.slice(0, 50).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {r.danglingReferences > 0 && <p className="notice notice-warn">{t('gedcom.dangling', { count: r.danglingReferences })}</p>}
      {r.warnings.length > 0 && (
        <div className="btn-row">
          <button type="button" className="btn" onClick={onShowWarnings}>
            {t('gedcom.warnings', { count: r.warnings.length })}
          </button>
        </div>
      )}
      {r.notes.length > 0 && (
        <ul className="small">
          {r.notes.map((n) => (
            <li key={n}>{t(NOTE_KEYS[n]!)}</li>
          ))}
        </ul>
      )}
      {r.notes.length === 0 && r.problems.length === 0 && r.uncertainDates.length === 0 && ignored.length === 0 && <p className="muted">{t('gedcom.nothingToReport')}</p>}
    </>
  );
}

function ExportReportBody({ r }: { r: ExportReport }) {
  const { t, locale } = useT();
  return (
    <>
      <dl className="detail-list">
        <div className="detail-field"><dt>{t('gedcom.people')}</dt><dd className="tnum">{formatNumber(locale, r.individuals)}</dd></div>
        <div className="detail-field"><dt>{t('gedcom.families')}</dt><dd className="tnum">{formatNumber(locale, r.families)}</dd></div>
      </dl>
      {r.preserved && r.preservedRecords > 0 && <p>{t('gedcom.preservedRecords', { count: r.preservedRecords })}</p>}
      {r.notes.length > 0 ? (
        <ul className="small">
          {r.notes.map((n) => (
            <li key={n}>{t(NOTE_KEYS[n]!)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t('gedcom.nothingToReport')}</p>
      )}
    </>
  );
}
