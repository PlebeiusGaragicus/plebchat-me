<script lang="ts">
	// Sidebar chat list grouped by recency (Today/Yesterday/This Week/Older).
	// Thread status dots return with the agent runtime in Phase 4.
	import { Trash2 } from '@lucide/svelte';
	import type { WorkspaceThread } from '$lib/db/types.js';
	import { workspace } from '../stores/workspace.svelte.js';

	interface Props {
		threads: WorkspaceThread[];
		onSelect: (thread: WorkspaceThread) => void;
		onDelete: (id: string, immediate: boolean) => void;
	}

	let { threads, onSelect, onDelete }: Props = $props();

	const DAY = 86_400_000;

	function startOfToday(): number {
		return new Date().setHours(0, 0, 0, 0);
	}

	function groupOf(timestamp: number): string {
		const today = startOfToday();
		if (timestamp >= today) return 'Today';
		if (timestamp >= today - DAY) return 'Yesterday';
		if (timestamp >= today - 6 * DAY) return 'This Week';
		return 'Older';
	}

	function formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		const today = startOfToday();
		if (timestamp >= today)
			return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		if (timestamp >= today - DAY) return 'Yesterday';
		if (timestamp >= today - 6 * DAY) return date.toLocaleDateString(undefined, { weekday: 'long' });
		return date.toLocaleDateString();
	}

	const grouped = $derived.by(() => {
		const groups = new Map<string, WorkspaceThread[]>();
		for (const thread of threads) {
			const key = groupOf(thread.updatedAt);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(thread);
		}
		return groups;
	});

	function isOpen(id: string): boolean {
		return (
			workspace.leftTabs.some((t) => t.id === id) || workspace.rightTabs.some((t) => t.id === id)
		);
	}
</script>

<div class="flex-1 overflow-y-auto py-1">
	{#if threads.length === 0}
		<div class="px-3 py-4 text-center text-xs text-muted-foreground/70">No chats yet</div>
	{:else}
		{#each grouped as [label, groupThreads] (label)}
			<div class="mb-3">
				<h4
					class="px-3 py-1 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase"
				>
					{label}
				</h4>
				<div class="space-y-0.5">
					{#each groupThreads as thread (thread.id)}
						<div
							class="group relative px-2"
							role="listitem"
							draggable="true"
							ondragstart={(e) => {
								e.dataTransfer?.setData('application/x-workspace-tab-id', thread.id);
								e.dataTransfer?.setData('application/x-workspace-tab-type', 'thread');
							}}
						>
							<button
								onclick={() => onSelect(thread)}
								class="flex w-full flex-col gap-1 rounded-lg p-2 text-left transition-all {isOpen(
									thread.id
								)
									? 'bg-accent ring-1 ring-border'
									: 'hover:bg-accent/50'}"
							>
								<div class="flex items-center justify-between gap-2">
									<h3 class="truncate text-sm font-medium">{thread.title}</h3>
									<span class="shrink-0 text-[10px] text-muted-foreground">
										{formatTime(thread.updatedAt)}
									</span>
								</div>
								{#if thread.description}
									<p class="line-clamp-1 text-xs text-muted-foreground">{thread.description}</p>
								{/if}
							</button>
							<button
								aria-label="Delete chat"
								onclick={(e) => {
									e.stopPropagation();
									onDelete(thread.id, e.shiftKey);
								}}
								title="Delete chat (Shift + click to skip confirmation)"
								class="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-popover/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:text-destructive"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
