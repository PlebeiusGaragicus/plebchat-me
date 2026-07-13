<script lang="ts">
	// Workspace sidebar (lean port of SvelteReader's SynthSidebar): project
	// header with back/collapse, collapsible Chats/Files/Sources sections with
	// create buttons, double-click rename for files, shift-click to skip the
	// delete confirm. Dropped from the original for now: tag system, thread
	// status filters (status returns with the agent in Phase 4).
	import { ChevronRight, FileText, Folder, Globe, PanelLeft, PanelLeftClose, Plus, Trash2 } from '@lucide/svelte';
	import type { Artifact, Project, Source, WorkspaceThread } from '$lib/db/types.js';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import { sources } from '../stores/sources.svelte.js';
	import { wsThreads } from '../stores/threads.svelte.js';
	import { workspace } from '../stores/workspace.svelte.js';
	import AddSourceModal from './AddSourceModal.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import ThreadList from './ThreadList.svelte';

	interface Props {
		project: Project;
		collapsed: boolean;
		onToggleCollapse: () => void;
		onBackToProjects: () => void;
		onSelect: (id: string, type: 'artifact' | 'thread' | 'source') => void;
	}

	let { project, collapsed, onToggleCollapse, onBackToProjects, onSelect }: Props = $props();

	let chatsExpanded = $state(true);
	let filesExpanded = $state(true);
	let sourcesExpanded = $state(false);

	let creatingFile = $state(false);
	let newFileTitle = $state('');
	let showSourceModal = $state(false);

	let editingArtifactId = $state<string | null>(null);
	let editingTitle = $state('');

	let confirm = $state<{ title: string; body: string; action: () => void } | null>(null);

	function isOpen(id: string): boolean {
		return (
			workspace.leftTabs.some((t) => t.id === id) || workspace.rightTabs.some((t) => t.id === id)
		);
	}

	async function handleNewThread() {
		const thread = await wsThreads.create();
		if (thread) onSelect(thread.id, 'thread');
	}

	async function createFile() {
		const title = newFileTitle.trim();
		creatingFile = false;
		newFileTitle = '';
		if (!title) return;
		const artifact = await artifacts.create(title.endsWith('.md') ? title : `${title}.md`);
		if (artifact) onSelect(artifact.id, 'artifact');
	}

	function startRenaming(artifact: Artifact) {
		editingArtifactId = artifact.id;
		editingTitle = artifacts.currentVersion(artifact.id)?.title ?? 'Untitled';
	}

	async function commitRename() {
		if (editingArtifactId && editingTitle.trim()) {
			await artifacts.rename(editingArtifactId, editingTitle);
		}
		editingArtifactId = null;
	}

	function deleteArtifact(artifact: Artifact, immediate: boolean) {
		const action = () => {
			void artifacts.remove(artifact.id);
			workspace.closeItemGlobally(artifact.id);
			confirm = null;
		};
		if (immediate) action();
		else
			confirm = {
				title: 'Delete file?',
				body: 'This permanently deletes the file and all its version history.',
				action
			};
	}

	function deleteThread(thread: WorkspaceThread, immediate: boolean) {
		const action = () => {
			void wsThreads.remove(thread.id);
			workspace.closeItemGlobally(thread.id);
			confirm = null;
		};
		if (immediate) action();
		else
			confirm = { title: 'Delete chat?', body: 'This permanently deletes this conversation.', action };
	}

	function deleteSource(source: Source, immediate: boolean) {
		const action = () => {
			void sources.remove(source.id);
			workspace.closeItemGlobally(source.id);
			confirm = null;
		};
		if (immediate) action();
		else
			confirm = {
				title: 'Delete source?',
				body: 'This removes the source from your project.',
				action
			};
	}
</script>

{#if collapsed}
	<div class="flex h-full w-12 flex-col items-center border-r border-border py-2">
		<button
			onclick={onToggleCollapse}
			class="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			title="Expand sidebar"
		>
			<PanelLeft class="h-5 w-5" />
		</button>
	</div>
{:else}
	<div class="flex h-full w-full flex-col border-r border-border">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-3 py-2">
			<button
				onclick={onBackToProjects}
				class="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				title="Back to projects"
			>
				<Folder class="h-4 w-4 shrink-0" />
				<span class="truncate">{project.title}</span>
			</button>
			<button
				onclick={onToggleCollapse}
				class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="Collapse sidebar"
			>
				<PanelLeftClose class="h-4 w-4" />
			</button>
		</div>

		<!-- Chats -->
		<div class="flex flex-col border-b border-border {chatsExpanded ? 'min-h-0 flex-1' : 'shrink-0'}">
			<div class="flex w-full items-center justify-between px-3 py-2">
				<button
					onclick={() => (chatsExpanded = !chatsExpanded)}
					class="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronRight class="h-4 w-4 transition-transform {chatsExpanded ? 'rotate-90' : ''}" />
					<span class="text-xs font-semibold tracking-wider uppercase">Chats</span>
				</button>
				<button
					onclick={handleNewThread}
					class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="New chat"
					aria-label="New chat"
				>
					<Plus class="h-4 w-4" strokeWidth={2.5} />
				</button>
			</div>
			{#if chatsExpanded}
				<ThreadList
					threads={wsThreads.all}
					onSelect={(t) => onSelect(t.id, 'thread')}
					onDelete={(id, immediate) => {
						const thread = wsThreads.get(id);
						if (thread) deleteThread(thread, immediate);
					}}
				/>
			{/if}
		</div>

		<!-- Files -->
		<div class="flex flex-col border-b border-border {filesExpanded ? 'min-h-0 flex-1' : 'shrink-0'}">
			<div class="flex w-full items-center justify-between px-3 py-2">
				<button
					onclick={() => (filesExpanded = !filesExpanded)}
					class="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronRight class="h-4 w-4 transition-transform {filesExpanded ? 'rotate-90' : ''}" />
					<span class="text-xs font-semibold tracking-wider uppercase">Files</span>
				</button>
				<button
					onclick={() => (creatingFile = true)}
					class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="New file"
					aria-label="New file"
				>
					<Plus class="h-4 w-4" strokeWidth={2.5} />
				</button>
			</div>
			{#if filesExpanded}
				<div class="flex-1 overflow-y-auto py-1">
					{#if creatingFile}
						<div class="px-3 pb-1">
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								bind:value={newFileTitle}
								onblur={createFile}
								onkeydown={(e) => {
									if (e.key === 'Enter') void createFile();
									else if (e.key === 'Escape') {
										creatingFile = false;
										newFileTitle = '';
									}
								}}
								placeholder="filename.md"
								class="h-7 w-full rounded border border-input bg-background px-2 text-sm focus:border-ring focus:outline-none"
								autofocus
							/>
						</div>
					{/if}
					{#if artifacts.all.length === 0 && !creatingFile}
						<div class="px-3 py-4 text-center text-xs text-muted-foreground/70">No files yet</div>
					{:else}
						{#each artifacts.all as artifact (artifact.id)}
							{@const title = artifact.versions[artifact.currentVersionIndex]?.title ?? 'Untitled'}
							<div
								class="group relative px-2"
								role="listitem"
								draggable="true"
								ondragstart={(e) => {
									e.dataTransfer?.setData('application/x-workspace-tab-id', artifact.id);
									e.dataTransfer?.setData('application/x-workspace-tab-type', 'artifact');
								}}
							>
								<button
									onclick={() => onSelect(artifact.id, 'artifact')}
									class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all {isOpen(
										artifact.id
									)
										? 'bg-accent ring-1 ring-border'
										: 'hover:bg-accent/50'}"
								>
									<FileText
										class="h-4 w-4 shrink-0 {isOpen(artifact.id)
											? 'text-primary'
											: 'text-muted-foreground'}"
									/>
									{#if editingArtifactId === artifact.id}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											bind:value={editingTitle}
											onblur={commitRename}
											onkeydown={(e) => {
												if (e.key === 'Enter') void commitRename();
												else if (e.key === 'Escape') editingArtifactId = null;
											}}
											onclick={(e) => e.stopPropagation()}
											class="h-6 w-full rounded border border-input bg-background px-1 text-sm font-medium focus:outline-none"
											autofocus
										/>
									{:else}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span
											ondblclick={() => startRenaming(artifact)}
											{title}
											class="truncate text-sm font-medium {isOpen(artifact.id)
												? ''
												: 'text-muted-foreground group-hover:text-foreground'}"
										>
											{title}
										</span>
									{/if}
								</button>
								<button
									aria-label="Delete file"
									onclick={(e) => {
										e.stopPropagation();
										deleteArtifact(artifact, e.shiftKey);
									}}
									title="Delete file (Shift + click to skip confirmation)"
									class="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-popover/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:text-destructive"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Sources -->
		<div
			class="flex flex-col border-b border-border {sourcesExpanded ? 'min-h-0 flex-1' : 'shrink-0'}"
		>
			<div class="flex w-full items-center justify-between px-3 py-2">
				<button
					onclick={() => (sourcesExpanded = !sourcesExpanded)}
					class="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronRight class="h-4 w-4 transition-transform {sourcesExpanded ? 'rotate-90' : ''}" />
					<span class="text-xs font-semibold tracking-wider uppercase">Sources</span>
				</button>
				<button
					onclick={() => (showSourceModal = true)}
					class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="Add source"
					aria-label="Add source"
				>
					<Plus class="h-4 w-4" strokeWidth={2.5} />
				</button>
			</div>
			{#if sourcesExpanded}
				<div class="flex-1 overflow-y-auto py-1">
					{#if sources.all.length === 0}
						<div class="px-3 py-4 text-center text-xs text-muted-foreground/70">No sources yet</div>
					{:else}
						{#each sources.all as source (source.id)}
							<div
								class="group relative px-2"
								role="listitem"
								draggable="true"
								ondragstart={(e) => {
									e.dataTransfer?.setData('application/x-workspace-tab-id', source.id);
									e.dataTransfer?.setData('application/x-workspace-tab-type', 'source');
								}}
							>
								<button
									onclick={() => onSelect(source.id, 'source')}
									class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all {isOpen(
										source.id
									)
										? 'bg-accent ring-1 ring-border'
										: 'hover:bg-accent/50'}"
								>
									<Globe
										class="h-4 w-4 shrink-0 {isOpen(source.id)
											? 'text-primary'
											: 'text-muted-foreground'}"
									/>
									<span
										class="truncate text-sm font-medium {isOpen(source.id)
											? ''
											: 'text-muted-foreground group-hover:text-foreground'}"
									>
										{source.title}
									</span>
								</button>
								<button
									aria-label="Delete source"
									onclick={(e) => {
										e.stopPropagation();
										deleteSource(source, e.shiftKey);
									}}
									title="Delete source (Shift + click to skip confirmation)"
									class="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-popover/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:text-destructive"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="mt-auto border-t border-border px-3 py-2 text-xs text-muted-foreground/70">
			{wsThreads.all.length}
			{wsThreads.all.length === 1 ? 'chat' : 'chats'} · {artifacts.all.length}
			{artifacts.all.length === 1 ? 'file' : 'files'} · {sources.all.length}
			{sources.all.length === 1 ? 'source' : 'sources'}
		</div>
	</div>
{/if}

{#if showSourceModal}
	<AddSourceModal
		onClose={() => (showSourceModal = false)}
		onAdded={(id) => {
			showSourceModal = false;
			onSelect(id, 'source');
		}}
	/>
{/if}

{#if confirm}
	<ConfirmDialog
		title={confirm.title}
		body={confirm.body}
		onConfirm={confirm.action}
		onCancel={() => (confirm = null)}
	/>
{/if}
