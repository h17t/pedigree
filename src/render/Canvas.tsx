import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Position, Project } from '@/model/types';
import { card, color, layout } from '@/design/tokens';
import type { Locale } from '@/i18n';
import { PersonCard } from './PersonCard';
import { UnionNode } from './UnionNode';
import { Connectors } from './Connectors';
import { Defs } from './Defs';
import { cardBox } from './geometry';
import type { Box, DetailLevel } from './geometry';
import { routeUnions } from './connectors';
import { clampZoom, snap, toWorld, zoomAt } from './viewport';
import type { Viewport } from './viewport';
import type { ClusterFrame } from './layout/clusters';

export interface CanvasProps {
  project: Project;
  positions: Map<string, Position>;
  visible: Set<string>;
  level: DetailLevel;
  locale: Locale;
  viewport: Viewport;
  selectedId: string | null;
  /** Additional selected people (multi-select). */
  multiSelected: Set<string>;
  warningIds: Set<string>;
  readOnly: boolean;
  snapToGrid: boolean;
  /** People whose position is not stored yet (drawn with a dotted outline). */
  provisional: Set<string>;
  /** Family boundaries with labels; drawn when there is more than one. */
  frames: ClusterFrame[];
  frameLabel: (f: ClusterFrame) => string;
  labels: { née: string; living: string; unknownDate: string; warning: string; unknownParents: string; canvas: string };
  cardLabel: (id: string) => string;
  onViewport: (v: Viewport) => void;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, pos: Position) => void;
  onMoveMany: (moves: { id: string; pos: Position }[]) => void;
  onMultiSelect: (ids: string[], mode: 'toggle' | 'set') => void;
  onDeleteKey: () => void;
  onSize?: (w: number, h: number) => void;
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; vx: number; vy: number; moved: boolean; tapTarget: string | null }
  | { kind: 'drag'; pointerId: number; id: string; startX: number; startY: number; origins: Map<string, Position>; moved: boolean }
  | { kind: 'band'; pointerId: number; startX: number; startY: number; moved: boolean }
  | { kind: 'pinch'; pointers: Map<number, { x: number; y: number }>; startDist: number; startZoom: number; startCenter: { x: number; y: number }; startViewport: Viewport };

const DRAG_THRESHOLD = 4;

/**
 * The SVG canvas. Pan with drag on the background (mouse, pen or one finger), middle mouse or
 * space+drag; zoom with the wheel, pinch or the buttons; select with click/tap; drag cards with
 * mouse or pen. Touch never drags cards (positions are edited on pointer devices). Every card
 * is a focusable button, and the list view is the keyboard-navigable equivalent of this canvas.
 */
/** Above this many visible cards the canvas culls off-screen cards and simplifies zoomed-out text. */
export const LARGE_TREE = 150;

export function Canvas(props: CanvasProps) {
  const { project, positions, visible, level, locale, viewport, selectedId, multiSelected, warningIds, readOnly, snapToGrid, provisional, frames, frameLabel, labels, cardLabel, onViewport, onSelect, onOpen, onMove, onMoveMany, onMultiSelect, onDeleteKey, onSize } = props;
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture>({ kind: 'none' });
  const [dragPos, setDragPos] = useState<Map<string, Position> | null>(null);
  const [band, setBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const spaceDown = useRef(false);

  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      onSize?.(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSize]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) spaceDown.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const boxes = useMemo(() => {
    const m = new Map<string, Box>();
    for (const id of visible) {
      const p = dragPos?.get(id) ?? positions.get(id);
      if (p) m.set(id, cardBox(p.x, p.y, level));
    }
    return m;
  }, [positions, visible, level, dragPos]);

  const unions = useMemo(() => routeUnions({ project, boxes, visible }), [project, boxes, visible]);

  // Large trees only (above LARGE_TREE people): cards outside the visible area (plus a margin
  // of one card) are not rendered, and below 40 % zoom cards draw only their name and years
  // (same box, less text) because the rest is unreadable at that size anyway. Small trees keep
  // every card in the DOM so keyboard and screen-reader users can reach all of them.
  const large = boxes.size > LARGE_TREE;
  const world = useMemo(() => {
    if (!large || size.w === 0 || size.h === 0) return null;
    const a = toWorld(viewport, 0, 0), b = toWorld(viewport, size.w, size.h);
    const m = card.width;
    return { x1: a.x - m, y1: a.y - m, x2: b.x + m, y2: b.y + m };
  }, [large, viewport, size]);
  const inView = useMemo(() => {
    if (!world) return [...boxes.entries()];
    return [...boxes.entries()].filter(([, b]) => b.x + b.w >= world.x1 && b.x <= world.x2 && b.y + b.h >= world.y1 && b.y <= world.y2);
  }, [boxes, world]);
  const sparse = large && viewport.zoom < 0.4;

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    if (e.pointerType === 'touch' && g.kind === 'pan') {
      // Second finger: switch to pinch.
      const pointers = new Map<number, { x: number; y: number }>();
      pointers.set(g.pointerId, { x: g.startX, y: g.startY });
      const p = localPoint(e);
      pointers.set(e.pointerId, p);
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gestureRef.current = { kind: 'pinch', pointers, startDist: Math.hypot(a.x - b.x, a.y - b.y), startZoom: viewport.zoom, startCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, startViewport: viewport };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (g.kind !== 'none') return;
    if (e.button !== 0 && e.button !== 1) return;
    const p = localPoint(e);
    if (e.shiftKey && e.pointerType !== 'touch' && e.button === 0) {
      gestureRef.current = { kind: 'band', pointerId: e.pointerId, startX: p.x, startY: p.y, moved: false };
    } else {
      gestureRef.current = { kind: 'pan', pointerId: e.pointerId, startX: p.x, startY: p.y, vx: viewport.x, vy: viewport.y, moved: false, tapTarget: null };
    }
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  // The card handler reads the latest viewport, positions and selection through a ref so that
  // its identity is stable: otherwise every pan or zoom step would re-render all (memoised)
  // cards, which is what makes a 500-person tree feel slow.
  const latest = useRef({ positions, readOnly, viewport, multiSelected, onMultiSelect });
  useLayoutEffect(() => {
    latest.current = { positions, readOnly, viewport, multiSelected, onMultiSelect };
  });
  const onCardPointerDown = useCallback((e: ReactPointerEvent<SVGGElement>, id: string) => {
    const { positions, readOnly, viewport, multiSelected, onMultiSelect } = latest.current;
    const g = gestureRef.current;
    if (g.kind !== 'none') return;
    if (e.button !== 0) return;
    const p = localPoint(e);
    if (e.shiftKey && e.pointerType !== 'touch') {
      e.stopPropagation();
      onMultiSelect([id], 'toggle');
      return;
    }
    const canDrag = !readOnly && e.pointerType !== 'touch' && !spaceDown.current;
    if (canDrag) {
      e.stopPropagation();
      // Dragging one of several selected cards moves the whole group.
      const group = multiSelected.has(id) && multiSelected.size > 1 ? [...multiSelected] : [id];
      const origins = new Map<string, Position>();
      for (const gid of group) origins.set(gid, positions.get(gid) ?? { x: 0, y: 0 });
      gestureRef.current = { kind: 'drag', pointerId: e.pointerId, id, startX: p.x, startY: p.y, origins, moved: false };
      svgRef.current?.setPointerCapture(e.pointerId);
    } else {
      // Touch or read-only: a tap selects, a drag pans.
      e.stopPropagation();
      gestureRef.current = { kind: 'pan', pointerId: e.pointerId, startX: p.x, startY: p.y, vx: viewport.x, vy: viewport.y, moved: false, tapTarget: id };
      svgRef.current?.setPointerCapture(e.pointerId);
    }
  }, []);

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    const p = localPoint(e);
    if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      const dx = p.x - g.startX, dy = p.y - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.moved = true;
      onViewport({ ...viewport, x: g.vx + dx, y: g.vy + dy });
    } else if (g.kind === 'drag' && g.pointerId === e.pointerId) {
      const dx = (p.x - g.startX) / viewport.zoom, dy = (p.y - g.startY) / viewport.zoom;
      if (!g.moved && Math.hypot(dx * viewport.zoom, dy * viewport.zoom) < DRAG_THRESHOLD) return;
      g.moved = true;
      // Alignment guides: snap the lead card's edges/centre to other cards within 6 px (world).
      let ax = 0, ay = 0;
      const gx: number[] = [], gy: number[] = [];
      const lead = g.origins.get(g.id)!;
      const lx = lead.x + dx, ly = lead.y + dy;
      const h = boxes.get(g.id)?.h ?? 0;
      const tol = 6 / viewport.zoom;
      if (!snapToGrid) {
        for (const [oid, b] of boxes) {
          if (g.origins.has(oid)) continue;
          for (const [mine, theirs] of [[lx, b.x], [lx + card.width, b.x + b.w], [lx + card.width / 2, b.x + b.w / 2]] as [number, number][]) {
            if (Math.abs(mine - theirs) < tol && !ax) {
              ax = theirs - mine;
              gx.push(theirs);
            }
          }
          for (const [mine, theirs] of [[ly, b.y], [ly + h, b.y + b.h], [ly + h / 2, b.y + b.h / 2]] as [number, number][]) {
            if (Math.abs(mine - theirs) < tol && !ay) {
              ay = theirs - mine;
              gy.push(theirs);
            }
          }
        }
      }
      const next = new Map<string, Position>();
      for (const [gid, o] of g.origins) {
        let x = o.x + dx + ax, y = o.y + dy + ay;
        if (snapToGrid) {
          x = snap(x, layout.grid);
          y = snap(y, layout.grid);
        }
        next.set(gid, { x, y });
      }
      setGuides({ x: gx, y: gy });
      setDragPos(next);
    } else if (g.kind === 'band' && g.pointerId === e.pointerId) {
      g.moved = true;
      setBand({ x: Math.min(g.startX, p.x), y: Math.min(g.startY, p.y), w: Math.abs(p.x - g.startX), h: Math.abs(p.y - g.startY) });
    } else if (g.kind === 'pinch' && g.pointers.has(e.pointerId)) {
      g.pointers.set(e.pointerId, p);
      const [a, b] = [...g.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoom = clampZoom((g.startZoom * dist) / Math.max(1, g.startDist));
      const k = zoom / g.startViewport.zoom;
      onViewport({ zoom, x: center.x - (g.startCenter.x - g.startViewport.x) * k, y: center.y - (g.startCenter.y - g.startViewport.y) * k });
    }
  };

  const endGesture = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gestureRef.current;
    if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      if (!g.moved) onSelect(g.tapTarget);
      gestureRef.current = { kind: 'none' };
    } else if (g.kind === 'drag' && g.pointerId === e.pointerId) {
      if (g.moved && dragPos) {
        if (dragPos.size === 1) onMove(g.id, dragPos.get(g.id)!);
        else onMoveMany([...dragPos.entries()].map(([id, pos]) => ({ id, pos })));
      } else onSelect(g.id);
      setDragPos(null);
      setGuides({ x: [], y: [] });
      gestureRef.current = { kind: 'none' };
    } else if (g.kind === 'band' && g.pointerId === e.pointerId) {
      if (band) {
        const x1 = (band.x - viewport.x) / viewport.zoom, y1 = (band.y - viewport.y) / viewport.zoom;
        const x2 = x1 + band.w / viewport.zoom, y2 = y1 + band.h / viewport.zoom;
        const hits = [...boxes.entries()].filter(([, b]) => b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1).map(([id]) => id);
        onMultiSelect(hits, 'set');
      }
      setBand(null);
      gestureRef.current = { kind: 'none' };
    } else if (g.kind === 'pinch') {
      g.pointers.delete(e.pointerId);
      if (g.pointers.size < 2) gestureRef.current = { kind: 'none' };
    }
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const p = localPoint(e);
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    onViewport(zoomAt(viewport, factor, p.x, p.y));
  };

  // React attaches wheel listeners passively; we need preventDefault to stop page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
      e.preventDefault();
      onDeleteKey();
      return;
    }
    if (e.target !== e.currentTarget) return; // cards handle their own keys
    const step = 60;
    if (e.key === 'ArrowLeft') onViewport({ ...viewport, x: viewport.x + step });
    else if (e.key === 'ArrowRight') onViewport({ ...viewport, x: viewport.x - step });
    else if (e.key === 'ArrowUp') onViewport({ ...viewport, y: viewport.y + step });
    else if (e.key === 'ArrowDown') onViewport({ ...viewport, y: viewport.y - step });
    else if (e.key === '+' || e.key === '=') onViewport(zoomAt(viewport, 1.2, 0, 0));
    else if (e.key === '-') onViewport(zoomAt(viewport, 1 / 1.2, 0, 0));
    else if (e.key === 'Escape') onSelect(null);
    else return;
    e.preventDefault();
  };

  const cardLabels = useMemo(() => ({ née: labels.née, living: labels.living, unknownDate: labels.unknownDate, warning: labels.warning }), [labels]);
  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      role="group"
      aria-label={labels.canvas}
      tabIndex={0}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      style={{ touchAction: 'none', background: color.ground }}
    >
      <Defs />
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        {frames.length > 1 &&
          frames.map((f) => (
            <g key={f.index} className="cluster-frame" aria-hidden="true">
              <rect x={f.box.x} y={f.box.y} width={f.box.w} height={f.box.h} rx={12} fill="none" stroke={color.rule} strokeWidth={1.5} strokeDasharray="10 8" />
              <text x={f.box.x + 16} y={f.box.y + 24} fontSize={15} fontWeight={500} fill={color.slate}>
                {frameLabel(f)}
              </text>
            </g>
          ))}
        {guides.x.map((gx, i) => (
          <line key={`gx${i}`} x1={gx} x2={gx} y1={-1e5} y2={1e5} stroke={color.select} strokeWidth={1 / viewport.zoom} strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`} />
        ))}
        {guides.y.map((gy, i) => (
          <line key={`gy${i}`} x1={-1e5} x2={1e5} y1={gy} y2={gy} stroke={color.select} strokeWidth={1 / viewport.zoom} strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`} />
        ))}
        <Connectors unions={unions} />
        {unions.map((u) => (
          <UnionNode key={u.unionId} cx={u.cx} cy={u.cy} unknownParents={u.unknownParents} label={labels.unknownParents} />
        ))}
        {inView.map(([id, b]) => {
          const person = project.persons[id];
          if (!person) return null;
          return (
            <PersonCard
              key={id}
              person={person}
              x={b.x}
              y={b.y}
              level={level}
              sparse={sparse}
              locale={locale}
              selected={id === selectedId || multiSelected.has(id)}
              provisional={provisional.has(id)}
              hasWarning={warningIds.has(id)}
              ariaLabel={cardLabel(id)}
              labels={cardLabels}
              onPointerDown={onCardPointerDown}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          );
        })}
      </g>
      {band && <rect className="rubber-band" x={band.x} y={band.y} width={band.w} height={band.h} />}
    </svg>
  );
}
