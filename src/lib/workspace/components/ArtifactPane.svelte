<script lang="ts">
	// Markdown file pane: version toolbar (history navigation + explicit
	// snapshot) over the CodeMirror live-preview editor. Navigating versions
	// or switching artifacts remounts the editor via {#key}.
	import { Camera, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import Editor from './Editor.svelte';

	interface Props {
		artifactId: string;
	}

	let { artifactId }: Props = $props();

	const artifact = $derived(artifacts.get(artifactId));
	const isDirty = $derived(artifacts.dirtyIds.includes(artifactId));
	const canPrev = $derived(!!artifact && artifact.currentVersionIndex > 0);
	const canNext = $derived(
		!!artifact && artifact.currentVersionIndex < artifact.versions.length - 1
	);
</script>

{#if !artifact}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
		File not found
	</div>
{:else}
	<div class="flex h-full flex-col">
		<div
			class="flex h-9 shrink-0 items-center justify-end gap-1 border-b border-border px-2 text-muted-foreground"
		>
			{#if isDirty}
				<span class="mr-auto pl-1 text-[10px] tracking-wider uppercase" title="Unsaved changes">
					Editing…
				</span>
			{/if}
			<button
				onclick={() => artifacts.setVersion(artifactId, artifact.currentVersionIndex - 1)}
				disabled={!canPrev}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
				title="Previous version"
				aria-label="Previous version"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>
			<span class="text-xs tabular-nums" data-testid="version-indicator">
				v{artifact.currentVersionIndex + 1}/{artifact.versions.length}
			</span>
			<button
				onclick={() => artifacts.setVersion(artifactId, artifact.currentVersionIndex + 1)}
				disabled={!canNext}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
				title="Next version"
				aria-label="Next version"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
			<button
				onclick={() => artifacts.snapshotVersion(artifactId)}
				class="ml-1 rounded p-1 transition-colors hover:bg-accent hover:text-foreground"
				title="Snapshot as new version"
				aria-label="Snapshot as new version"
			>
				<Camera class="h-4 w-4" />
			</button>
		</div>
		<div class="min-h-0 flex-1">
			{#key `${artifactId}:${artifact.currentVersionIndex}`}
				<Editor {artifactId} />
			{/key}
		</div>
	</div>
{/if}
