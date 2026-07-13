<script lang="ts">
	// Workspace for one open project. Phase 1 ships the header (back +
	// rename-in-place); the pane layout lands in Phase 2 (see
	// docs/proposals/synthesize-mode.md).
	import { ArrowLeft } from '@lucide/svelte';
	import type { Project } from '$lib/db/types.js';
	import { projects } from '../stores/projects.svelte.js';

	interface Props {
		project: Project;
		onBack: () => void;
	}

	let { project, onBack }: Props = $props();

	let editingTitle = $state(false);
	let titleDraft = $state('');

	function startRename() {
		titleDraft = project.title;
		editingTitle = true;
	}

	async function commitRename() {
		editingTitle = false;
		if (titleDraft.trim() && titleDraft.trim() !== project.title) {
			await projects.rename(project.id, titleDraft);
		}
	}
</script>

<div class="flex h-[calc(100dvh-3.5rem)] flex-col">
	<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
		<button
			aria-label="Back to projects"
			onclick={onBack}
			class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
		</button>
		{#if editingTitle}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={titleDraft}
				onblur={commitRename}
				onkeydown={(e) => {
					if (e.key === 'Enter') void commitRename();
					else if (e.key === 'Escape') editingTitle = false;
				}}
				class="rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold focus:border-ring focus:outline-none"
				autofocus
			/>
		{:else}
			<button
				onclick={startRename}
				class="rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-accent"
				title="Rename project"
			>
				{project.title}
			</button>
		{/if}
	</header>

	<div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
		<p>Workspace panes coming next — files, chats, and sources will live here.</p>
	</div>
</div>
