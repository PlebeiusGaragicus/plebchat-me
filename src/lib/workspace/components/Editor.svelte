<script lang="ts">
	// CodeMirror 6 markdown editor for one artifact, with Obsidian-style live
	// preview (socratic-seminar's Editor). Keystrokes land in
	// artifacts.updateLiveContent (runtime only); a 500ms debounced flush
	// persists in place — versions are only created by explicit snapshot.
	// Mount one instance per artifact+version ({#key} in ArtifactPane).
	// Cmd/Ctrl+click a [[Title]] wiki-link to follow (creates if missing).
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { EditorView } from '@codemirror/view';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import { workspace } from '../stores/workspace.svelte.js';

	let { artifactId }: { artifactId: string } = $props();

	let container: HTMLDivElement;
	let editor: EditorView | null = null;
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	const AUTOSAVE_DELAY = 500;

	function scheduleAutoSave() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveTimeout = null;
			void artifacts.flush(artifactId);
		}, AUTOSAVE_DELAY);
	}

	function flushNow() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		void artifacts.flush(artifactId);
	}

	async function followWikilink(title: string) {
		flushNow();
		const target = artifacts.findByTitle(title) ?? (await artifacts.create(title));
		if (target) workspace.openItem(target.id, 'artifact');
	}

	onMount(async () => {
		const [view, state, markdown, langData, commands, language, livePreviewMod] =
			await Promise.all([
				import('@codemirror/view'),
				import('@codemirror/state'),
				import('@codemirror/lang-markdown'),
				import('@codemirror/language-data'),
				import('@codemirror/commands'),
				import('@codemirror/language'),
				import('../editor/livePreview.js')
			]);

		// Base look from the app's semantic tokens — follows light/dark.
		const baseTheme = view.EditorView.theme({
			'&': { height: '100%', fontSize: '16px', backgroundColor: 'transparent' },
			'&.cm-focused': { outline: 'none' },
			'.cm-content': {
				padding: '8px 16px 16px',
				caretColor: 'var(--color-primary)',
				fontFamily: 'inherit'
			},
			'.cm-cursor': { borderLeftColor: 'var(--color-primary)', borderLeftWidth: '2px' },
			'.cm-activeLine': {
				backgroundColor: 'color-mix(in oklab, var(--color-accent) 45%, transparent)'
			},
			'.cm-line': { lineHeight: '1.75', padding: '0 8px' },
			'.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
			'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
				backgroundColor: 'color-mix(in oklab, var(--color-primary) 22%, transparent)'
			}
		});

		editor = new view.EditorView({
			state: state.EditorState.create({
				doc: artifacts.getLiveContent(artifactId) ?? '',
				extensions: [
					view.highlightActiveLine(),
					commands.history(),
					markdown.markdown({ codeLanguages: langData.languages }),
					language.syntaxHighlighting(language.defaultHighlightStyle, { fallback: true }),
					view.keymap.of([...commands.defaultKeymap, ...commands.historyKeymap]),
					baseTheme,
					livePreviewMod.livePreview,
					view.EditorView.lineWrapping,
					view.EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							artifacts.updateLiveContent(artifactId, update.state.doc.toString());
							scheduleAutoSave();
						}
					}),
					view.EditorView.domEventHandlers({
						blur: () => {
							if (saveTimeout) flushNow();
						},
						mousedown: (event) => {
							if (!(event.metaKey || event.ctrlKey)) return;
							const link = (event.target as HTMLElement).closest?.('[data-wikilink]');
							const title = link?.getAttribute('data-wikilink');
							if (title) {
								event.preventDefault();
								void followWikilink(title);
								return true;
							}
						}
					})
				]
			}),
			parent: container
		});
	});

	// External updates (agent patches in Phase 4, flush reconciliation):
	// overwrite the editor unless the user is mid-typing (pending autosave).
	$effect(() => {
		const content = artifacts.getLiveContent(artifactId);
		if (!editor || content === null) return;
		const current = untrack(() => editor!.state.doc.toString());
		if (current !== content && !saveTimeout) {
			editor.dispatch({ changes: { from: 0, to: current.length, insert: content } });
		}
	});

	onDestroy(() => {
		flushNow();
		editor?.destroy();
		editor = null;
	});
</script>

<div bind:this={container} data-testid="artifact-editor" class="h-full min-h-0"></div>
