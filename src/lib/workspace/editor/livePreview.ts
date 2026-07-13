// Obsidian-style live preview for CodeMirror (socratic-seminar's extension,
// recolored to the app's semantic CSS tokens so it works in light AND dark,
// and extended with [[Title]] wiki-links between artifacts):
// markdown syntax markers are visible only on the line/block the cursor is in.

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

class HorizontalRuleWidget extends WidgetType {
	toDOM() {
		const hr = document.createElement('hr');
		hr.className = 'cm-hr-rendered';
		return hr;
	}
}

function getActiveLines(view: EditorView): Set<number> {
	const activeLines = new Set<number>();
	for (const range of view.state.selection.ranges) {
		const startLine = view.state.doc.lineAt(range.from).number;
		const endLine = view.state.doc.lineAt(range.to).number;
		for (let i = startLine; i <= endLine; i++) activeLines.add(i);
	}
	return activeLines;
}

function isInsideBlock(view: EditorView, blockFrom: number, blockTo: number): boolean {
	return view.state.selection.ranges.some((r) => r.from >= blockFrom && r.to <= blockTo);
}

const WIKILINK_RE = /\[\[([^\][]+)\]\]/g;

function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const activeLines = getActiveLines(view);
	const decorations: Range<Decoration>[] = [];

	syntaxTree(view.state).iterate({
		enter(node) {
			const lineStart = view.state.doc.lineAt(node.from).number;
			const lineEnd = view.state.doc.lineAt(node.to).number;
			const isActive = [...activeLines].some((l) => l >= lineStart && l <= lineEnd);

			// ATX headings (#, ##, …)
			if (/^ATXHeading[1-6]$/.test(node.name)) {
				const level = parseInt(node.name.slice(-1));
				const line = view.state.doc.lineAt(node.from);
				const text = view.state.sliceDoc(node.from, node.to);
				const hashMatch = text.match(/^(#{1,6})\s*/);
				if (hashMatch) {
					const markEnd = node.from + hashMatch[0].length;
					decorations.push(
						Decoration.line({ class: `cm-header cm-header-${level}` }).range(line.from)
					);
					if (!isActive) {
						decorations.push(Decoration.replace({}).range(node.from, markEnd));
					} else {
						decorations.push(
							Decoration.mark({ class: 'cm-formatting-header' }).range(node.from, markEnd)
						);
					}
				}
			}

			// Bold / italic / inline code — hide the markers unless active.
			const inline = { StrongEmphasis: 2, Emphasis: 1, InlineCode: 1 }[node.name];
			if (inline !== undefined && node.to - node.from >= inline * 2) {
				const cls = { StrongEmphasis: 'cm-strong', Emphasis: 'cm-emphasis', InlineCode: 'cm-inline-code' }[
					node.name
				]!;
				decorations.push(Decoration.mark({ class: cls }).range(node.from, node.to));
				if (!isActive) {
					decorations.push(Decoration.replace({}).range(node.from, node.from + inline));
					decorations.push(Decoration.replace({}).range(node.to - inline, node.to));
				} else {
					decorations.push(
						Decoration.mark({ class: 'cm-formatting' }).range(node.from, node.from + inline)
					);
					decorations.push(
						Decoration.mark({ class: 'cm-formatting' }).range(node.to - inline, node.to)
					);
				}
			}

			// Fenced code blocks
			if (node.name === 'FencedCode') {
				const cursorInside = isInsideBlock(view, node.from, node.to);
				const startLine = view.state.doc.lineAt(node.from);
				const endLine = view.state.doc.lineAt(node.to);
				const lines = view.state.sliceDoc(node.from, node.to).split('\n');
				const hasClosingFence = lines.length > 1 && /^`{3,}$/.test(lines[lines.length - 1].trim());
				for (let i = startLine.number; i <= endLine.number; i++) {
					const line = view.state.doc.line(i);
					const isFence =
						i === startLine.number || (hasClosingFence && i === endLine.number);
					if (!isFence) {
						decorations.push(Decoration.line({ class: 'cm-codeblock-line' }).range(line.from));
					} else {
						decorations.push(Decoration.line({ class: 'cm-codeblock-fence' }).range(line.from));
						if (line.text.length > 0) {
							decorations.push(
								cursorInside
									? Decoration.mark({ class: 'cm-formatting-code-fence' }).range(
											line.from,
											line.to
										)
									: Decoration.replace({}).range(line.from, line.to)
							);
						}
					}
				}
			}

			// Blockquotes
			if (node.name === 'Blockquote') {
				const startLine = view.state.doc.lineAt(node.from);
				const endLine = view.state.doc.lineAt(node.to);
				for (let i = startLine.number; i <= endLine.number; i++) {
					const line = view.state.doc.line(i);
					const quoteMatch = line.text.match(/^(\s*>\s*)/);
					if (!quoteMatch) continue;
					decorations.push(Decoration.line({ class: 'cm-blockquote-line' }).range(line.from));
					decorations.push(
						activeLines.has(i)
							? Decoration.mark({ class: 'cm-formatting' }).range(
									line.from,
									line.from + quoteMatch[1].length
								)
							: Decoration.replace({}).range(line.from, line.from + quoteMatch[1].length)
					);
				}
			}

			// Links [text](url)
			if (node.name === 'Link') {
				decorations.push(Decoration.mark({ class: 'cm-link' }).range(node.from, node.to));
				const text = view.state.sliceDoc(node.from, node.to);
				const linkMatch = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
				if (linkMatch && !isActive) {
					const textEnd = node.from + 1 + linkMatch[1].length;
					decorations.push(Decoration.replace({}).range(node.from, node.from + 1));
					decorations.push(Decoration.replace({}).range(textEnd, node.to));
				}
			}

			// Horizontal rules
			if (node.name === 'HorizontalRule') {
				const line = view.state.doc.lineAt(node.from);
				decorations.push(
					activeLines.has(line.number)
						? Decoration.mark({ class: 'cm-formatting' }).range(node.from, node.to)
						: Decoration.replace({ widget: new HorizontalRuleWidget() }).range(
								node.from,
								node.to
							)
				);
			}

			if (node.name === 'ListItem') {
				const line = view.state.doc.lineAt(node.from);
				decorations.push(Decoration.line({ class: 'cm-list-item' }).range(line.from));
			}
		}
	});

	// [[Title]] wiki-links (not part of the markdown grammar — regex over the
	// visible ranges). data-wikilink carries the target title for the click
	// handler in the editor component.
	for (const { from, to } of view.visibleRanges) {
		const text = view.state.sliceDoc(from, to);
		for (const match of text.matchAll(WIKILINK_RE)) {
			const start = from + match.index;
			const end = start + match[0].length;
			const line = view.state.doc.lineAt(start).number;
			decorations.push(
				Decoration.mark({
					class: 'cm-wikilink',
					attributes: { 'data-wikilink': match[1] }
				}).range(start, end)
			);
			if (!activeLines.has(line)) {
				decorations.push(Decoration.replace({}).range(start, start + 2));
				decorations.push(Decoration.replace({}).range(end - 2, end));
			} else {
				decorations.push(Decoration.mark({ class: 'cm-formatting' }).range(start, start + 2));
				decorations.push(Decoration.mark({ class: 'cm-formatting' }).range(end - 2, end));
			}
		}
	}

	decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
	for (const deco of decorations) builder.add(deco.from, deco.to, deco.value);
	return builder.finish();
}

const livePreviewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations }
);

// Colors come from the app's semantic tokens so the editor follows the
// light/dark theme; monospace only for code, prose font elsewhere.
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const livePreviewTheme = EditorView.theme({
	'.cm-header': { fontWeight: '600' },
	'.cm-header-1': { fontSize: '1.75em' },
	'.cm-header-2': { fontSize: '1.4em' },
	'.cm-header-3': { fontSize: '1.2em' },
	'.cm-header-4': { fontSize: '1.1em' },
	'.cm-header-5': { fontSize: '1em' },
	'.cm-header-6': { fontSize: '0.95em', color: 'var(--color-muted-foreground)' },

	'.cm-formatting': {
		opacity: '0.4',
		color: 'var(--color-muted-foreground)',
		fontFamily: MONO,
		fontSize: '0.85em'
	},
	'.cm-formatting-header': {
		opacity: '0.4',
		color: 'var(--color-primary)',
		fontFamily: MONO
	},
	'.cm-formatting-code-fence': {
		opacity: '0.4',
		color: 'var(--color-muted-foreground)',
		fontFamily: MONO,
		fontSize: '0.875em'
	},

	'.cm-codeblock-line': {
		backgroundColor: 'var(--color-muted)',
		fontFamily: MONO,
		fontSize: '0.875em',
		borderLeft: '2px solid var(--color-border)'
	},
	'.cm-codeblock-fence': {
		backgroundColor: 'var(--color-muted)',
		fontFamily: MONO,
		fontSize: '0.875em',
		borderLeft: '2px solid var(--color-border)'
	},

	'.cm-strong': { fontWeight: '700' },
	'.cm-emphasis': { fontStyle: 'italic' },

	'.cm-inline-code': {
		backgroundColor: 'var(--color-muted)',
		padding: '0 0.35em',
		borderRadius: '3px',
		fontFamily: MONO,
		fontSize: '0.875em'
	},

	'.cm-blockquote-line': {
		borderLeft: '3px solid var(--color-primary)',
		paddingLeft: '1.25em',
		color: 'var(--color-muted-foreground)',
		fontStyle: 'italic'
	},

	'.cm-link': {
		color: 'var(--color-primary)',
		textDecoration: 'none',
		borderBottom: '1px solid color-mix(in oklab, var(--color-primary) 35%, transparent)',
		cursor: 'pointer'
	},
	'.cm-wikilink': {
		color: 'var(--color-primary)',
		borderBottom: '1px dashed color-mix(in oklab, var(--color-primary) 45%, transparent)',
		cursor: 'pointer'
	},

	'.cm-hr-rendered': {
		border: 'none',
		borderTop: '1px solid var(--color-border)',
		margin: '1.5em 0'
	},

	'.cm-list-item': { paddingLeft: '0.25em' }
});

export const livePreview = [livePreviewPlugin, livePreviewTheme];
