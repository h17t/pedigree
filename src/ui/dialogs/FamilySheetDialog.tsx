import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n';
import { intlTag } from '@/i18n';
import { useAppStore } from '@/store/store';
import { downloadText } from '@/store/projects';
import { buildFamilySheet, familySheetBody, familySheetHtml, SHEET_CSS } from '@/report/familySheet';
import { privateIds, withoutPrivate } from '@/model/privacy';
import type { SheetLabels } from '@/report/familySheet';
import { Dialog } from '../components/Dialog';
import { closeEditor } from '../edit/editorStore';
import { announce } from '../status';

/** The family sheet of one person: shown in a dialog, printable, saved as a standalone HTML file. */
export function FamilySheetDialog({ id }: { id: string }) {
  const { t, locale } = useT();
  const project = useAppStore((s) => s.project)!;
  const [printing, setPrinting] = useState(false);
  const labels: SheetLabels = useMemo(
    () => ({
      title: t('sheet.title'),
      parents: t('sheet.parents'),
      parentsRelationship: t('sheet.parentsRelationship'),
      siblings: t('sheet.siblings'),
      partnerships: t('sheet.partnerships'),
      partner: t('sheet.partner'),
      children: t('sheet.children'),
      events: t('sheet.events'),
      notes: t('sheet.notes'),
      sources: t('sheet.sources'),
      none: t('sheet.none'),
      generated: t('sheet.generated', { date: new Intl.DateTimeFormat(intlTag[locale], { dateStyle: 'long' }).format(new Date()) }),
    }),
    [t, locale],
  );
  // Like every other output, the sheet leaves people marked private out; the person it is about is always shown.
  const source = useMemo(() => {
    const subject = project.persons[id];
    if (!subject) return project;
    return withoutPrivate(subject.isPrivate ? { ...project, persons: { ...project.persons, [id]: { ...subject, isPrivate: false } } } : project);
  }, [project, id]);
  const othersHidden = useMemo(() => [...privateIds(project)].some((pid) => pid !== id), [project, id]);
  const sheet = useMemo(() => buildFamilySheet(source, id, locale, t), [source, id, locale, t]);
  const body = useMemo(() => (sheet ? familySheetBody(sheet, labels) : ''), [sheet, labels]);

  useEffect(() => {
    if (!printing) return;
    const after = () => {
      setPrinting(false);
      window.removeEventListener('afterprint', after);
    };
    window.addEventListener('afterprint', after);
    const timer = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', after);
    };
  }, [printing]);

  if (!sheet) return null;
  const save = () => {
    const safe = sheet.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'person';
    const file = `${t('sheet.filePrefix')}-${safe}.html`;
    downloadText(familySheetHtml(sheet, labels, locale), file);
    announce(t('sheet.saved', { file }));
  };
  return (
    <Dialog open title={t('sheet.title')} onClose={closeEditor} wide>
      <div className="stack">
        <p className="muted">
          {t('sheet.intro')}
          {othersHidden && <> {t('sheet.privateHint')}</>}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => setPrinting(true)}>
            {t('sheet.print')}
          </button>
          <button type="button" className="btn" onClick={save}>
            {t('sheet.saveHtml')}
          </button>
        </div>
        <style>{SHEET_CSS.replace(/body \{[^}]*\}/, '')}</style>
        {/* The preview scrolls, so keyboard users must be able to focus it (axe: scrollable-region-focusable). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above */}
        <div className="family-sheet sheet-preview" role="region" aria-label={t('sheet.title')} tabIndex={0} dangerouslySetInnerHTML={{ __html: body }} />
      </div>
      {printing &&
        createPortal(
          <div id="print-root" aria-hidden="true">
            <style>{SHEET_CSS}</style>
            <main className="family-sheet" dangerouslySetInnerHTML={{ __html: body }} />
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
