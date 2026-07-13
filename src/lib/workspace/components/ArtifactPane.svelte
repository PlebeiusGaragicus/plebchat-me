<script lang="ts">
	// Markdown file pane. Phase 2 interim: a plain textarea saving on a short
	// debounce — Phase 3 replaces the body with CodeMirror live preview and
	// version snapshots (the header/save plumbing stays).
	import { artifacts } from '../stores/artifacts.svelte.js';

	interface Props {
		artifactId: string;
	}

	let { artifactId }: Props = $props();

	const artifact = $derived(artifacts.get(artifactId));
	const version = $derived(artifacts.currentVersion(artifactId));

	// Local draft per open artifact; re-seeded when the tab switches files.
	let draft = $state('');
	let seededFor = $state<string | null>(null);
	$effect(() => {
		if (seededFor !== artifactId) {
			seededFor = artifactId;
			draft = version?.content ?? '';
		}
	});

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	function handleInput() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void artifacts.setContent(artifactId, draft), 500);
	}

	$effect(() => () => {
		// Flush the pending debounce on unmount so nothing is lost.
		if (saveTimer !== undefined) {
			clearTimeout(saveTimer);
			void artifacts.setContent(artifactId, draft);
		}
	});
</script>

{#if !artifact || !version}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
		File not found
	</div>
{:else}
	<textarea
		bind:value={draft}
		oninput={handleInput}
		placeholder="Start writing…"
		spellcheck="false"
		class="h-full w-full resize-none bg-transparent p-4 font-mono text-sm focus:outline-none"
	></textarea>
{/if}
