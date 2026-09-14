import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSample, expectNoHorizontalScroll } from './helpers';

async function openTree(page: Page) {
  await openSample(page);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  // wait for the initial fit
  await page.waitForTimeout(300);
}

test('canvas renders every visible person as a focusable card and has no accessibility violations', async ({ page }) => {
  await openTree(page);
  const cards = page.locator('.person-card');
  await expect(cards).toHaveCount(48);
  await expect(page.getByRole('button', { name: /Karl Weber, born 1878/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('zoom buttons, fit and 100 % change the zoom level', async ({ page }) => {
  await openTree(page);
  const zoomGroup = page.getByRole('group', { name: /Zoom:/ });
  const before = await zoomGroup.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const after = await zoomGroup.getAttribute('aria-label');
  expect(after).not.toBe(before);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    // The 100 % reset button is shown from tablet width up; phones use Fit and pinch.
    await page.getByRole('button', { name: '100 %' }).click();
    await expect(page.getByRole('group', { name: 'Zoom: 100 %' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(page.getByRole('group', { name: 'Zoom: 100 %' })).toHaveCount(0);
});

test('selecting a card shows the details; search jumps to a person; filter hides the rest', async ({ page }) => {
  await openTree(page);
  await page.getByLabel('Type a name to jump to a person').fill('karl');
  await page.getByRole('button', { name: /Karl Weber, born 1878/ }).first().click();
  await page.waitForTimeout(200);
  const w = page.viewportSize()?.width ?? 0;
  if (w < 1024) {
    await expect(page.getByRole('region', { name: 'Selected: Karl Weber' })).toBeVisible();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('button', { name: 'Details' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Karl Weber' })).toBeVisible();
  if (w < 1024) await page.getByRole('button', { name: 'Back' }).click();

  await page.getByLabel('Type a name to jump to a person').fill('lindner');
  await page.getByRole('button', { name: /Johann Lindner/ }).first().click();
  await expect(page.getByRole('button', { name: /Johann Lindner, born 1860/ })).toHaveAttribute('aria-pressed', 'true');

  if (w < 1024) await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Descendants of Johann Lindner' }).click();
  await expect(page.locator('.person-card')).toHaveCount(7);
  await expect(page.getByText(/41 people hidden/)).toBeVisible();
  await page.getByRole('button', { name: 'Show everyone' }).click();
  await expect(page.locator('.person-card')).toHaveCount(48);
});

test('keyboard: Enter on a focused card selects it, Escape clears', async ({ page }) => {
  await openTree(page);
  await page.getByLabel('Type a name to jump to a person').fill('anna weber');
  await page.getByRole('button', { name: /Anna Weber.*1884/ }).first().click();
  await page.waitForTimeout(200);
  const card = page.locator('.person-card[data-person-id]').filter({ hasText: 'Anna Weber' }).first();
  await page.getByRole('group', { name: /Family tree canvas/ }).focus();
  await page.keyboard.press('Escape');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: /Family tree canvas/ }).focus();
  await page.keyboard.press('Escape');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
});

test('legend opens and lists the line styles', async ({ page }) => {
  await openTree(page);
  await page.getByRole('button', { name: 'Legend' }).click();
  await expect(page.getByText('Divorced: double line crossed by two strokes')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Divorced: double line crossed by two strokes')).toHaveCount(0);
});

test.describe('desktop only', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'drag needs a mouse');
  test('dragging a card moves it and the position survives a reload', async ({ page }) => {
    await openTree(page);
    // Jump to Otto so his card is centred in the canvas at a readable zoom.
    await page.getByLabel('Type a name to jump to a person').fill('otto');
    await page.getByRole('button', { name: /Otto Weber, born 1885/ }).first().click();
    await page.waitForTimeout(200);
    const card = page.locator('.person-card[data-person-id]').filter({ hasText: 'Otto Weber' });
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 130, box.y + 90, { steps: 8 });
    await page.mouse.up();
    const moved = (await card.boundingBox())!;
    expect(Math.round(moved.x - box.x)).toBe(100);
    expect(Math.round(moved.y - box.y)).toBe(60);
    // Compare relative to the canvas: a notice above it (e.g. "ready to work offline" after the
    // first load) may shift the whole canvas without changing the stored position.
    const canvas = page.getByRole('group', { name: /Family tree canvas/ });
    const canvasBefore = (await canvas.boundingBox())!;
    await page.reload();
    await expect(canvas).toBeVisible();
    const canvasAfter = (await canvas.boundingBox())!;
    const after = (await page.getByRole('button', { name: /Otto Weber, born 1885/ }).boundingBox())!;
    expect(Math.round(after.x - canvasAfter.x)).toBe(Math.round(moved.x - canvasBefore.x));
    expect(Math.round(after.y - canvasAfter.y)).toBe(Math.round(moved.y - canvasBefore.y));
  });

  test('select area: a plain drag draws a rectangle, dragging one selected card moves the group', async ({ page }) => {
    await openTree(page);
    // The service worker's "ready to work offline" notice arrives a moment after the first load
    // and shifts the canvas down; wait for it and dismiss it so nothing moves during the test.
    const offlineNotice = page.locator('section.notice').filter({ hasText: /ready to work without an internet connection/ });
    await offlineNotice.waitFor({ timeout: 4000 }).catch(() => undefined);
    if (await offlineNotice.isVisible()) await offlineNotice.getByRole('button', { name: 'Dismiss' }).click();
    await page.getByLabel('Type a name to jump to a person').fill('otto');
    await page.getByRole('button', { name: /Otto Weber, born 1885/ }).first().click();
    await page.waitForTimeout(200);
    const select = page.getByRole('button', { name: 'Select area' });
    await expect(select).toHaveAttribute('aria-pressed', 'false');
    await select.click();
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    const canvas = page.getByRole('group', { name: /Family tree canvas/ });
    const c = (await canvas.boundingBox())!;
    const vh = page.viewportSize()!.height;
    // Start on empty background (not on a card, frame label or the hint callout): scan the canvas
    // from the bottom left for a point whose element is the canvas itself.
    const start = await page.evaluate(
      ({ x, y, w, h }) => {
        for (let yy = y + h - 20; yy > y + 20; yy -= 40) {
          for (let xx = x + 20; xx < x + w - 20; xx += 40) {
            const el = document.elementFromPoint(xx, yy);
            if (el && el.closest('svg.tree-canvas') && !el.closest('[data-person-id]') && !el.closest('.cluster-frame')) return { x: xx, y: yy };
          }
        }
        return null;
      },
      { x: c.x, y: c.y, w: c.width, h: Math.min(c.height, vh - c.y) },
    );
    expect(start).not.toBeNull();
    // A rectangle from there to the opposite corner catches Otto (centred) and his neighbours.
    const farX = start!.x < c.x + c.width / 2 ? c.x + c.width - 10 : c.x + 10;
    const farY = start!.y < c.y + Math.min(c.height, vh - c.y) / 2 ? Math.min(c.y + c.height, vh) - 10 : c.y + 10;
    await page.mouse.move(start!.x, start!.y);
    await page.mouse.down();
    await page.mouse.move(farX, farY, { steps: 10 });
    await expect(page.locator('.rubber-band')).toBeVisible();
    await page.mouse.up();
    const bar = page.getByRole('status').filter({ hasText: /people selected/ });
    await expect(bar).toBeVisible();
    const count = Number(/(\d+) people selected/.exec((await bar.textContent()) ?? '')?.[1]);
    expect(count).toBeGreaterThan(1);
    // Drag the selected card nearest the canvas centre (fully visible, away from the hint) and
    // check that another selected card moves by the same amount. Positions are measured relative
    // to the canvas, because a notice above it (e.g. "ready to work offline") can shift the whole
    // canvas meanwhile.
    const selected = page.locator('.person-card-selected[data-person-id]');
    const cards = await selected.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { id: el.getAttribute('data-person-id')!, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    expect(cards.length).toBeGreaterThan(1);
    const cx = c.x + c.width / 2, cy = c.y + Math.min(c.height, vh - c.y) / 2;
    const dist = (b: { x: number; y: number; w: number; h: number }) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    const byDistance = [...cards].sort((p, q) => dist(p) - dist(q));
    const drag = byDistance[0], other = byDistance[1];
    // One evaluate reads a card and the canvas in the same frame, so a notice appearing above the
    // canvas between two reads cannot fake a move.
    const rel = (id: string) =>
      page.evaluate((pid) => {
        const card = document.querySelector(`.person-card[data-person-id="${pid}"]`)!.getBoundingClientRect();
        const cv = document.querySelector('svg.tree-canvas')!.getBoundingClientRect();
        return { x: card.x - cv.x, y: card.y - cv.y };
      }, id);
    const dragBefore = await rel(drag.id), otherBefore = await rel(other.id);
    // hover() waits until the card really receives pointer events at that point (nothing covers it)
    // and uses the card's position at that moment.
    const dragCard = page.locator(`.person-card[data-person-id="${drag.id}"]`);
    await dragCard.hover({ position: { x: 30, y: 30 } });
    const grip = (await dragCard.boundingBox())!;
    await page.mouse.down();
    await page.mouse.move(grip.x + 110, grip.y + 70, { steps: 8 });
    await page.mouse.up();
    const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 120) ?? 'none', [grip.x + 30, grip.y + 30]);
    await expect.poll(async () => (await rel(drag.id)).x - dragBefore.x, { message: `card did not move; under the pointer: ${under}` }).toBeGreaterThan(40);
    const dragAfter = await rel(drag.id), otherAfter = await rel(other.id);
    const dx = dragAfter.x - dragBefore.x, dy = dragAfter.y - dragBefore.y;
    expect(Math.abs(dx - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(dy - 40)).toBeLessThanOrEqual(2);
    expect(Math.abs(otherAfter.x - otherBefore.x - dx)).toBeLessThanOrEqual(2);
    expect(Math.abs(otherAfter.y - otherBefore.y - dy)).toBeLessThanOrEqual(2);
    // Undo puts the whole group back in one step.
    await page.keyboard.press('Control+z');
    await expect.poll(async () => Math.abs((await rel(other.id)).x - otherBefore.x)).toBeLessThanOrEqual(3);
    expect(Math.abs((await rel(drag.id)).x - dragBefore.x)).toBeLessThanOrEqual(3);
    // A click on the background in select mode clears the selection; the mode is a toggle.
    await page.mouse.click(start!.x, start!.y);
    await expect(bar).toHaveCount(0);
    await select.click();
    await expect(select).toHaveAttribute('aria-pressed', 'false');
  });
});

test('layout panel: arrange the whole tree stores positions, families can be shown one by one, snap toggles', async ({ page }) => {
  await openTree(page);
  // Before arranging, the sample has no stored positions: cards are dotted.
  await expect(page.locator('.person-card rect[stroke-dasharray="4 3"]')).toHaveCount(48);
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByRole('button', { name: 'Show family 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Arrange the whole tree' }).click();
  await expect(page.getByText('The tree was arranged.')).toBeVisible();
  await expect(page.locator('.person-card rect[stroke-dasharray="4 3"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Show family 2' }).click();
  await expect(page.locator('.person-card').filter({ hasText: 'Johann Lindner' })).toBeInViewport();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Snap to grid: off' }).click();
  await expect(page.getByRole('button', { name: 'Snap to grid: on' })).toBeVisible();
  // Undo restores the unarranged state
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.person-card rect[stroke-dasharray="4 3"]')).toHaveCount(48);
});

test('spacing makes the tree narrower or wider, undoes as one step and is stored with the tree', async ({ page }) => {
  await openTree(page);
  // Width of the drawing measured in card widths, so the zoom level does not matter.
  const widthInCards = async () => {
    await page.waitForTimeout(200);
    const cards = page.locator('.person-card');
    const n = await cards.count();
    let min = Infinity, max = -Infinity, cardW = 0;
    for (let i = 0; i < n; i++) {
      const box = await cards.nth(i).locator('rect').first().boundingBox();
      if (!box) continue;
      min = Math.min(min, box.x);
      max = Math.max(max, box.x + box.width);
      cardW = Math.max(cardW, box.width);
    }
    return (max - min) / cardW;
  };
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByLabel('Spacing')).toHaveValue('normal');
  await page.getByLabel('Spacing').selectOption('compact');
  await expect(page.getByText(/Spacing: Compact\. The tree was arranged\./)).toBeVisible();
  await page.getByRole('button', { name: 'Layout' }).click();
  const compact = await widthInCards();
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByLabel('Spacing').selectOption('wide');
  await expect(page.getByText(/Spacing: Wide/)).toBeVisible();
  await page.getByRole('button', { name: 'Layout' }).click();
  const wide = await widthInCards();
  expect(compact).toBeLessThan(wide * 0.9);
  // One undo step per change.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByLabel('Spacing')).toHaveValue('compact');
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.reload();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByLabel('Spacing')).toHaveValue('compact');
});

test('balance generations shrinks the crowded generations, undoes as one step, survives a reload and prints', async ({ page }) => {
  await openTree(page);
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Arrange the whole tree' }).click(); // closes the panel
  // Widths of every card's outline: identical without balancing, spread out with it.
  const widths = async () => {
    const cards = page.locator('.person-card');
    const n = await cards.count();
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const box = await cards.nth(i).locator('rect').nth(0).boundingBox();
      if (box) out.push(box.width);
    }
    return { min: Math.min(...out), max: Math.max(...out) };
  };
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.waitForTimeout(200);
  const before = await widths();
  expect(before.min / before.max).toBeGreaterThan(0.98);
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByLabel('Balance generations')).toHaveValue('off');
  await page.getByLabel('Balance generations').selectOption('strong');
  await expect(page.getByText(/Balance generations: Strong/)).toBeVisible();
  // One undo step turns it off again (undo history is in memory, so this comes before the reload).
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Balance generations')).toHaveValue('off');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByLabel('Balance generations')).toHaveValue('strong');
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.waitForTimeout(200);
  // The crowded generations are drawn smaller than the sparse ones.
  const after = await widths();
  expect(after.min / after.max).toBeLessThan(0.75);
  // The setting is stored with the tree.
  await page.reload();
  await expect(page.getByRole('group', { name: /Family tree canvas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Layout' }).click();
  await expect(page.getByLabel('Balance generations')).toHaveValue('strong');
  await page.getByRole('button', { name: 'Layout' }).click();
  // Printing still works and reports the smaller text.
  await page.getByRole('button', { name: 'Print & export' }).click();
  await expect(page.locator('.print-sheet svg').first()).toBeVisible();
  await expect(page.getByText(/Smallest text on paper/)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
});
