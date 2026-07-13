<script lang="ts">
	// Left rail, SvelteReader ChatSidebar shape: collapsed icon rail by
	// default, expanding to a searchable, date-grouped research history.
	import {
		Clock,
		MessageSquare,
		PanelLeft,
		PanelLeftClose,
		Plus,
		Search,
		Trash2,
		X
	} from '@lucide/svelte';
	import type { SearchThread } from '$lib/db/types.js';
	import { searchThreads } from '../stores/threads.svelte.js';
	import { searchUi } from '../stores/ui.svelte.js';

	let searchQuery = $state('');
	let deleteConfirmId = $state<string | null>(null);

	const filtered = $derived(
		searchQuery.trim()
			? searchThreads.threads.filter((t) =>
					t.title.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: searchThreads.threads
	);

	const grouped = $derived.by(() => {
		const now = Date.now();
		const day = 86_400_000;
		const groups: { label: string; threads: SearchThread[] }[] = [
			{ label: 'Today', threads: [] },
			{ label: 'Yesterday', threads: [] },
			{ label: 'Previous 7 days', threads: [] },
			{ label: 'Older', threads: [] }
		];
		const today = new Date().toDateString();
		const yesterday = new Date(now - day).toDateString();
		for (const thread of filtered) {
			const d = new Date(thread.updatedAt).toDateString();
			if (d === today) groups[0].threads.push(thread);
			else if (d === yesterday) groups[1].threads.push(thread);
			else if (now - thread.updatedAt < 7 * day) groups[2].threads.push(thread);
			else groups[3].threads.push(thread);
		}
		return groups.filter((g) => g.threads.length > 0);
	});

	function ago(ts: number): string {
		const s = Math.floor((Date.now() - ts) / 1000);
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
		const d = Math.floor(s / 86_400);
		if (d < 7) return `${d}d ago`;
		if (d < 30) return `${Math.floor(d / 7)}w ago`;
		return `${Math.floor(d / 30)}mo ago`;
	}

	function newResearch() {
		searchThreads.activeId = null;
	}

	function handleDelete(id: string) {
		if (deleteConfirmId === id) {
			deleteConfirmId = null;
			void searchThreads.remove(id);
		} else {
			deleteConfirmId = id;
			setTimeout(() => {
				if (deleteConfirmId === id) deleteConfirmId = null;
			}, 3000);
		}
	}
</script>

{#if searchUi.threadSidebarCollapsed}
	<div
		class="flex h-full w-14 shrink-0 flex-col items-center border-r border-border bg-muted/20 py-3"
		data-testid="thread-sidebar-collapsed"
	>
		<button
			class="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
			title="Expand sidebar"
			data-testid="thread-sidebar-expand"
			onclick={() => (searchUi.threadSidebarCollapsed = false)}
		>
			<PanelLeft class="size-5" />
		</button>
		<button
			class="mt-3 rounded-full bg-primary p-2.5 text-primary-foreground hover:bg-primary/90"
			title="New research"
			data-testid="search-new-thread"
			onclick={newResearch}
		>
			<Plus class="size-5" />
		</button>
		<div class="mt-4 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
			{#each searchThreads.threads.slice(0, 10) as thread (thread.id)}
				<button
					class="w-full rounded-lg p-2 {thread.id === searchThreads.activeId
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
					title={thread.title}
					onclick={() => (searchThreads.activeId = thread.id)}
				>
					<MessageSquare class="mx-auto size-5" />
				</button>
			{/each}
		</div>
	</div>
{:else}
	<div
		class="flex h-full w-64 shrink-0 flex-col border-r border-border bg-muted/20"
		data-testid="thread-sidebar"
	>
		<div class="flex items-center justify-between border-b border-border px-3 py-3">
			<span class="text-sm font-semibold">Research History</span>
			<div class="flex items-center gap-0.5">
				<button
					class="rounded-lg p-1.5 text-primary hover:bg-accent"
					title="New research"
					data-testid="search-new-thread"
					onclick={newResearch}
				>
					<Plus class="size-4" />
				</button>
				<button
					class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					title="Collapse sidebar"
					onclick={() => (searchUi.threadSidebarCollapsed = true)}
				>
					<PanelLeftClose class="size-4" />
				</button>
			</div>
		</div>

		<div class="px-3 py-2">
			<div class="relative">
				<Search
					class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search…"
					class="w-full rounded-lg border border-border bg-background py-1.5 pr-7 pl-8 text-xs focus:outline-none"
				/>
				{#if searchQuery}
					<button
						class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onclick={() => (searchQuery = '')}
					>
						<X class="size-3" />
					</button>
				{/if}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-2 pb-2">
			{#if grouped.length === 0}
				<div class="flex flex-col items-center px-2 py-8 text-center">
					<MessageSquare class="mb-2 size-6 text-muted-foreground/50" />
					<p class="text-xs text-muted-foreground">
						{searchQuery ? 'No results found' : 'No research history'}
					</p>
					{#if !searchQuery}
						<p class="mt-1 text-[10px] text-muted-foreground/70">
							Start a new research to see it here
						</p>
					{/if}
				</div>
			{:else}
				{#each grouped as group (group.label)}
					<div class="mb-3">
						<h3
							class="px-2 py-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
						>
							{group.label}
						</h3>
						<div class="space-y-0.5">
							{#each group.threads as thread (thread.id)}
								{@const isActive = thread.id === searchThreads.activeId}
								{@const isDeleting = deleteConfirmId === thread.id}
								<div class="group relative">
									<button
										data-testid="search-thread"
										class="w-full rounded-lg px-2.5 py-2 text-left {isActive
											? 'bg-primary/10'
											: 'hover:bg-accent'}"
										onclick={() => (searchThreads.activeId = thread.id)}
									>
										<p class="truncate text-xs font-medium {isActive ? 'text-primary' : ''}">
											{thread.title}
										</p>
										<div class="mt-0.5 flex items-center gap-1.5">
											<Clock class="size-2.5 text-muted-foreground" />
											<span class="text-[10px] text-muted-foreground">{ago(thread.updatedAt)}</span>
											<span class="text-[10px] text-muted-foreground">
												· {thread.sources.length} src
											</span>
										</div>
									</button>
									<button
										class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 transition-all {isDeleting
											? 'bg-destructive text-white opacity-100'
											: 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive'}"
										title={isDeleting ? 'Click to confirm' : 'Delete thread'}
										onclick={(e) => {
											e.stopPropagation();
											handleDelete(thread.id);
										}}
									>
										<Trash2 class="size-3" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
