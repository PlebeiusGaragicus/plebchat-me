// The only module that touches the book renderer (vendored foliate-js —
// see vendor/foliate/VENDORED.md). Live book/view objects are plain module
// state — never $state (proxies break them) — and every renderer quirk is
// contained here so it stays swappable. The exported contract predates the
// renderer: it is unchanged from the epub.js era, and annotation positions
// are standard EPUB CFI strings, so data created under epub.js resolves here.

import { makeBook } from './vendor/foliate/view.js';
import * as CFI from './vendor/foliate/epubcfi.js';
import { Overlayer } from './vendor/foliate/overlayer.js';
import { db } from '$lib/db/index.js';
import type { Annotation, HighlightColor } from '$lib/db/types.js';
import type { ReadingSettings } from '$lib/stores/settings.svelte.js';

export interface TocEntry {
	label: string;
	href: string;
	depth: number;
}

export interface SelectionInfo {
	cfiRange: string;
	text: string;
	/** Viewport (fixed-position) coords of the selection. */
	rect: DOMRect;
}

// Saturated marks read well on all three reading themes.
export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
	yellow: 'rgba(255, 224, 0, 0.45)',
	green: 'rgba(0, 216, 100, 0.4)',
	blue: 'rgba(60, 170, 250, 0.4)',
	pink: 'rgba(244, 114, 182, 0.45)',
	purple: 'rgba(168, 85, 247, 0.4)'
};
const NOTE_UNDERLINE = 'rgb(220, 38, 38)';
// Other readers' shared highlights: dashed sky underline — read-only marks,
// visually distinct from own highlights (fill) and own notes (solid red).
const FOREIGN_UNDERLINE = 'rgb(14, 165, 233)';

const READING_THEMES: Record<ReadingSettings['theme'], { background: string; color: string }> = {
	light: { background: '#ffffff', color: '#1c1917' },
	dark: { background: '#18181b', color: '#d4d4d8' },
	sepia: { background: '#f4ecd8', color: '#5b4636' }
};

// Minimal typed surface over the untyped vendored View element.
interface FoliateView extends HTMLElement {
	open(book: unknown): Promise<void>;
	close(): void;
	init(opts: { lastLocation?: string | null }): Promise<void>;
	goTo(target: string | number): Promise<unknown>;
	next(): Promise<void>;
	prev(): Promise<void>;
	deselect(): void;
	getCFI(index: number, range: Range): string;
	addAnnotation(a: { value: string }, remove?: boolean): Promise<unknown>;
	deleteAnnotation(a: { value: string }): Promise<unknown>;
	renderer: HTMLElement & { setStyles(css: string): void };
	book: FoliateBook;
}

interface FoliateBook {
	metadata?: Record<string, unknown>;
	toc?: FoliateTocItem[];
	getCover?(): Promise<Blob | null>;
	destroy?(): void;
}

interface FoliateTocItem {
	label: string;
	href: string;
	subitems?: FoliateTocItem[];
}

/** What we know about a mark we put on the overlay, keyed by CFI range. */
type MarkMeta =
	| { kind: 'highlight'; id: string; color: HighlightColor }
	| { kind: 'note'; id: string }
	| { kind: 'foreign'; id: string };

let book: FoliateBook | null = null;
let view: FoliateView | null = null;
let opened: Promise<void> | null = null;
let initialized = false;
let hasRendered = false;
let lastFraction: number | undefined;
let lastCfi: string | null = null;
let pendingSettings: ReadingSettings | null = null;
const marks = new Map<string, MarkMeta>();

let selectionCb: ((sel: SelectionInfo) => void) | null = null;
let markClickCb: ((id: string, rect: DOMRect | null) => void) | null = null;
let relocatedCb: ((loc: { cfi: string; href?: string; percentage?: number }) => void) | null =
	null;
let renderedCb: (() => void) | null = null;

export async function openBook(sha256: string): Promise<void> {
	destroy();
	const record = await db.bookFiles.get(sha256);
	if (!record) throw new Error('Book file missing from local storage');
	const file = new File([record.blob], 'book.epub', {
		type: record.blob.type || 'application/epub+zip'
	});
	book = (await makeBook(file)) as FoliateBook;
}

export function renderTo(container: HTMLElement, settings: ReadingSettings): void {
	if (!book) throw new Error('No book open');
	const v = document.createElement('foliate-view') as FoliateView;
	view = v;
	pendingSettings = settings;
	v.style.width = '100%';
	v.style.height = '100%';
	v.style.display = 'block';

	v.addEventListener('load', (e) => {
		const { doc, index } = (e as CustomEvent<{ doc: Document; index: number }>).detail;
		attachSelectionHandler(doc, index);
		const first = !hasRendered;
		hasRendered = true;
		if (first) renderedCb?.();
	});

	v.addEventListener('relocate', (e) => {
		const detail = (e as CustomEvent<{ cfi: string; fraction?: number; tocItem?: { href?: string } }>)
			.detail;
		lastFraction = detail.fraction;
		// foliate relocates for non-navigation reasons too (resize, style
		// application, anchor scrolls). Consumers treat relocate as "the page
		// turned" (progress save, selection clearing) — only forward real moves.
		if (detail.cfi === lastCfi) return;
		lastCfi = detail.cfi;
		relocatedCb?.({
			cfi: detail.cfi,
			href: detail.tocItem?.href,
			percentage: detail.fraction
		});
	});

	// The overlay for a section is created when that section loads — re-add
	// every registered mark; ones outside the section are no-ops.
	v.addEventListener('create-overlay', () => {
		for (const cfi of marks.keys()) void v.addAnnotation({ value: cfi });
	});

	v.addEventListener('draw-annotation', (e) => {
		const { draw, annotation } = (
			e as CustomEvent<{
				draw: (fn: unknown, opts?: unknown) => void;
				annotation: { value: string };
			}>
		).detail;
		const meta = marks.get(annotation.value);
		if (!meta) return;
		if (meta.kind === 'highlight') {
			draw(Overlayer.highlight, { color: HIGHLIGHT_COLORS[meta.color] });
		} else if (meta.kind === 'note') {
			draw(Overlayer.underline, { color: NOTE_UNDERLINE, width: 2 });
		} else {
			draw(dashedUnderline, { color: FOREIGN_UNDERLINE, width: 2 });
		}
	});

	// A click on an existing mark (the overlayer hit test).
	v.addEventListener('show-annotation', (e) => {
		const { value, range } = (e as CustomEvent<{ value: string; range?: Range }>).detail;
		const meta = marks.get(value);
		if (!meta || meta.kind === 'foreign') return;
		markClickCb?.(meta.id, range ? toViewportRect(range) : null);
	});

	container.append(v);
	opened = v.open(book).then(() => {
		if (pendingSettings) applyDisplaySettings(pendingSettings);
	});
}

/** Custom overlay draw: dashed underline for other readers' highlights. */
function dashedUnderline(
	rects: { left: number; bottom: number; width: number }[],
	options: { color?: string; width?: number } = {}
): SVGElement {
	const { color = 'red', width: strokeWidth = 2 } = options;
	const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	g.setAttribute('class', 'vr-foreign-underline');
	g.setAttribute('stroke', color);
	g.setAttribute('stroke-width', String(strokeWidth));
	g.setAttribute('stroke-dasharray', '3 2');
	for (const { left, bottom, width } of rects) {
		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', String(left));
		line.setAttribute('x2', String(left + width));
		line.setAttribute('y1', String(bottom - strokeWidth / 2));
		line.setAttribute('y2', String(bottom - strokeWidth / 2));
		g.append(line);
	}
	return g;
}

function attachSelectionHandler(doc: Document, index: number): void {
	doc.addEventListener('mouseup', () => {
		const sel = doc.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
		const text = sel.toString().trim();
		if (!text || !view) return;
		const range = sel.getRangeAt(0);
		let cfiRange: string;
		try {
			cfiRange = view.getCFI(index, range);
		} catch {
			return;
		}
		const rect = toViewportRect(range);
		if (rect) selectionCb?.({ cfiRange, text, rect });
	});
}

/** Translate an in-iframe rect to viewport coords via the owning iframe. */
function toViewportRect(range: Range): DOMRect | null {
	const rect = range.getBoundingClientRect();
	const frame = range.startContainer.ownerDocument?.defaultView?.frameElement;
	if (!frame) return rect;
	const frameRect = frame.getBoundingClientRect();
	return new DOMRect(frameRect.left + rect.left, frameRect.top + rect.top, rect.width, rect.height);
}

export async function display(target?: string): Promise<void> {
	if (!view || !opened) return;
	await opened;
	if (!initialized) {
		initialized = true;
		await view.init({ lastLocation: target ?? null });
		return;
	}
	if (target) await view.goTo(target);
}

export function next(): void {
	void view?.next();
}

export function prev(): void {
	void view?.prev();
}

export function getToc(): TocEntry[] {
	if (!book) throw new Error('No book open');
	const entries: TocEntry[] = [];
	const walk = (items: FoliateTocItem[], depth: number) => {
		for (const item of items) {
			entries.push({ label: (item.label ?? '').trim(), href: item.href, depth });
			if (item.subitems?.length) walk(item.subitems, depth + 1);
		}
	};
	walk(book.toc ?? [], 0);
	return entries;
}

export function sectionLabelFor(href: string | undefined): string | undefined {
	if (!href) return undefined;
	const plain = href.split('#')[0];
	return getToc().find((t) => t.href.split('#')[0] === plain)?.label;
}

// ---- progress ----

/** foliate computes overall progress natively (relocate carries `fraction`) —
 * the epub.js locations cache is gone; this resolves immediately. */
export async function ensureLocations(): Promise<void> {}

export function percentageFromCfi(_cfi: string): number | undefined {
	return lastFraction;
}

// ---- annotations ----

/** Never sort CFIs lexically — parse and compare properly. */
export function compareCfi(a: string, b: string): number {
	try {
		return CFI.compare(a, b) as number;
	} catch {
		return 0;
	}
}

export function applyAnnotation(anno: Annotation): void {
	if (!view) return;
	marks.set(
		anno.cfiRange,
		anno.color
			? { kind: 'highlight', id: anno.id, color: anno.color }
			: { kind: 'note', id: anno.id }
	);
	void view.addAnnotation({ value: anno.cfiRange });
}

export function removeAnnotation(anno: Annotation): void {
	if (!view) return;
	marks.delete(anno.cfiRange);
	void view.deleteAnnotation({ value: anno.cfiRange });
}

export function applyForeignAnnotation(anno: { id: string; cfiRange: string }): void {
	if (!view || !hasRendered) return;
	// Own marks win if both target the same range.
	if (marks.has(anno.cfiRange)) return;
	marks.set(anno.cfiRange, { kind: 'foreign', id: anno.id });
	void view.addAnnotation({ value: anno.cfiRange });
}

export function removeForeignAnnotation(anno: { cfiRange: string }): void {
	if (!view) return;
	const meta = marks.get(anno.cfiRange);
	if (meta?.kind !== 'foreign') return;
	marks.delete(anno.cfiRange);
	void view.deleteAnnotation({ value: anno.cfiRange });
}

export function clearSelection(): void {
	try {
		view?.deselect();
	} catch {
		// Best-effort.
	}
}

// ---- display settings ----

export function applyDisplaySettings(s: ReadingSettings): void {
	pendingSettings = s;
	if (!view?.renderer?.setStyles) return;
	const theme = READING_THEMES[s.theme];
	view.renderer.setStyles(`
		html, body {
			background: ${theme.background} !important;
			color: ${theme.color} !important;
		}
		html {
			font-size: ${s.fontSize}px !important;
			line-height: ${s.lineHeight} !important;
			${s.fontFamily ? `font-family: ${s.fontFamily} !important;` : ''}
		}
		p {
			line-height: ${s.lineHeight} !important;
			${s.fontFamily ? `font-family: ${s.fontFamily} !important;` : ''}
		}
	`);
}

// ---- lifecycle & callbacks ----

export function onSelection(cb: typeof selectionCb): void {
	selectionCb = cb;
}
export function onMarkClick(cb: typeof markClickCb): void {
	markClickCb = cb;
}
export function onRelocated(cb: typeof relocatedCb): void {
	relocatedCb = cb;
}
/** Fires once, after the first section renders — the annotation-safe point. */
export function onFirstRendered(cb: typeof renderedCb): void {
	renderedCb = cb;
}

export function destroy(): void {
	try {
		view?.close();
		view?.remove();
	} catch {
		// Discarding anyway.
	}
	try {
		book?.destroy?.();
	} catch {
		// Discarding anyway.
	}
	book = null;
	view = null;
	opened = null;
	initialized = false;
	hasRendered = false;
	lastFraction = undefined;
	lastCfi = null;
	pendingSettings = null;
	marks.clear();
	selectionCb = null;
	markClickCb = null;
	relocatedCb = null;
	renderedCb = null;
}
