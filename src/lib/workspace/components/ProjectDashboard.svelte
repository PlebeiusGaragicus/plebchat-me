<script lang="ts">
	// Project grid (SvelteReader's ProjectDashboard, restyled to our semantic
	// tokens): new-project card, project cards with artifact count + recency,
	// hover delete with confirm. Mode-agnostic — copy comes in via props.
	import { Clock, FileText, Folder, Plus, Trash2 } from '@lucide/svelte';
	import type { Project } from '$lib/db/types.js';
	import { projects } from '../stores/projects.svelte.js';

	interface Props {
		heading: string;
		subheading: string;
		onSelect: (project: Project) => void;
	}

	let { heading, subheading, onSelect }: Props = $props();

	let newTitle = $state('');
	let isCreating = $state(false);
	let toDelete = $state<Project | null>(null);

	function formatDate(timestamp: number): string {
		const diffMs = Date.now() - timestamp;
		const diffHours = diffMs / 3_600_000;
		if (diffHours < 1) return `${Math.floor(diffMs / 60_000)}m ago`;
		if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
		if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}d ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	async function createProject() {
		const title = newTitle.trim();
		if (!title) return;
		newTitle = '';
		isCreating = false;
		onSelect(await projects.create(title));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') void createProject();
		else if (e.key === 'Escape') {
			isCreating = false;
			newTitle = '';
		}
	}

	async function confirmDelete() {
		if (!toDelete) return;
		await projects.remove(toDelete.id);
		toDelete = null;
	}
</script>

<div class="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
	<div class="mb-8">
		<h2 class="text-2xl font-bold">{heading}</h2>
		<p class="mt-1 text-muted-foreground">{subheading}</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#if isCreating}
			<div class="rounded-xl border border-primary/50 bg-card p-6">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={newTitle}
					onkeydown={handleKeydown}
					placeholder="Project name…"
					class="w-full rounded-lg border border-input bg-background px-4 py-2 placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
					autofocus
				/>
				<div class="mt-4 flex gap-2">
					<button
						onclick={createProject}
						disabled={!newTitle.trim()}
						class="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						Create
					</button>
					<button
						onclick={() => {
							isCreating = false;
							newTitle = '';
						}}
						class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				data-testid="new-project"
				onclick={() => (isCreating = true)}
				class="group flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-6 transition-all hover:border-primary/50 hover:bg-card"
			>
				<div
					class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/15"
				>
					<Plus class="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
				</div>
				<span class="font-medium text-muted-foreground transition-colors group-hover:text-foreground">
					New Project
				</span>
			</button>
		{/if}

		{#each projects.all as project (project.id)}
			<div
				class="group relative flex min-h-[160px] cursor-pointer flex-col rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-muted-foreground/40 hover:bg-accent/50"
				onclick={() => onSelect(project)}
				onkeydown={(e) => e.key === 'Enter' && onSelect(project)}
				role="button"
				tabindex="0"
			>
				<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
					<Folder class="h-5 w-5 text-primary" />
				</div>

				<h3 class="mb-1 font-semibold">{project.title}</h3>

				<div class="mt-auto flex items-center gap-4 text-sm text-muted-foreground">
					<span class="flex items-center gap-1">
						<FileText class="h-3.5 w-3.5" />
						{projects.artifactCount(project.id)}
						{projects.artifactCount(project.id) === 1 ? 'file' : 'files'}
					</span>
					<span class="flex items-center gap-1">
						<Clock class="h-3.5 w-3.5" />
						{formatDate(project.updatedAt)}
					</span>
				</div>

				<button
					aria-label="Delete project"
					onclick={(e) => {
						e.stopPropagation();
						toDelete = project;
					}}
					class="absolute top-3 right-3 rounded-lg p-2 text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		{/each}
	</div>

	{#if projects.all.length === 0 && !isCreating}
		<div class="mt-8 text-center text-muted-foreground">
			<p>No projects yet. Create your first project to get started.</p>
		</div>
	{/if}
</div>

{#if toDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-sm rounded-xl border border-border bg-popover p-6 shadow-xl">
			<h3 class="text-lg font-semibold">Delete “{toDelete.title}”?</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				This permanently deletes the project with all its files, chats, and sources. This cannot
				be undone.
			</p>
			<div class="mt-6 flex gap-3">
				<button
					onclick={() => (toDelete = null)}
					class="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
				>
					Cancel
				</button>
				<button
					onclick={confirmDelete}
					class="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}
