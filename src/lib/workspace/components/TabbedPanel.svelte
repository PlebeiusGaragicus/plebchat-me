<script lang="ts">
	// One tabbed column (port of SvelteReader's TabbedPanel): draggable tabs,
	// drop-to-move between columns, drop-on-right-edge to split when the right
	// panel is collapsed, and a "+" menu for new files/chats. Content renders
	// via snippets so the layout stays agnostic of the panes.
	import type { Snippet } from 'svelte';
	import {
		FileText,
		Link,
		MessageSquare,
		PanelRightClose,
		PanelRightOpen,
		Plus,
		X
	} from '@lucide/svelte';
	import type { TabItem, TabType } from '$lib/db/types.js';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import { sources } from '../stores/sources.svelte.js';
	import { wsThreads } from '../stores/threads.svelte.js';
	import { workspace } from '../stores/workspace.svelte.js';

	interface Props {
		column: 'left' | 'right';
		tabs: TabItem[];
		activeTabId: string | null;
		onNewFile: (column: 'left' | 'right') => void;
		onNewThread: (column: 'left' | 'right') => void;
		showClosePanel?: boolean;
		thread?: Snippet<[{ activeTabId: string }]>;
		artifact?: Snippet<[{ activeTabId: string }]>;
		source?: Snippet<[{ activeTabId: string }]>;
	}

	let {
		column,
		tabs,
		activeTabId,
		onNewFile,
		onNewThread,
		showClosePanel = false,
		thread,
		artifact,
		source
	}: Props = $props();

	let isDraggingOver = $state(false);
	let isDraggingRightEdge = $state(false);
	let newMenuOpen = $state(false);

	const TAB_ICONS = { thread: MessageSquare, artifact: FileText, source: Link } as const;

	function tabTitle(tab: TabItem): string {
		if (tab.type === 'artifact') return artifacts.currentVersion(tab.id)?.title ?? 'Untitled';
		if (tab.type === 'thread') return wsThreads.get(tab.id)?.title ?? 'Chat';
		return sources.get(tab.id)?.title ?? 'Source';
	}

	function handleDragStart(e: DragEvent, tab: TabItem) {
		e.dataTransfer?.setData('application/x-workspace-tab-id', tab.id);
		e.dataTransfer?.setData('application/x-workspace-tab-type', tab.type);
		e.dataTransfer?.setData('application/x-workspace-tab-column', column);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		isDraggingOver = true;
		if (column === 'left' && workspace.rightPanelCollapsed && !workspace.singleColumn) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			isDraggingRightEdge = e.clientX - rect.left > rect.width * 0.8;
		} else {
			isDraggingRightEdge = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const splitRight = isDraggingRightEdge;
		isDraggingOver = false;
		isDraggingRightEdge = false;

		const id = e.dataTransfer?.getData('application/x-workspace-tab-id');
		const type = e.dataTransfer?.getData('application/x-workspace-tab-type') as TabType | '';
		const from = e.dataTransfer?.getData('application/x-workspace-tab-column');
		if (!id || !type) return;

		const target: 'left' | 'right' = splitRight ? 'right' : column;
		if (from === 'left' || from === 'right') {
			if (from !== target) workspace.moveTab(id, from, target);
		} else {
			// Dragged from the sidebar.
			workspace.openItem(id, type, target);
		}
	}
</script>

<div
	class="relative flex h-full flex-col"
	ondragover={handleDragOver}
	ondragleave={() => {
		isDraggingOver = false;
		isDraggingRightEdge = false;
	}}
	ondrop={handleDrop}
	role="region"
	aria-label="Tabbed workspace panel"
>
	{#if isDraggingOver}
		<div
			class="pointer-events-none absolute inset-0 z-40 border-2 border-primary/30 transition-all {isDraggingRightEdge
				? 'border-r-4 border-r-primary/60 bg-gradient-to-l from-primary/10 to-transparent'
				: 'bg-primary/5'}"
		>
			{#if isDraggingRightEdge}
				<div
					class="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-primary px-2 py-1 text-[10px] font-bold tracking-wider text-primary-foreground uppercase shadow-lg"
				>
					Split Right
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tab bar -->
	<div class="flex h-10 items-center border-b border-border bg-card/50">
		<div class="flex flex-1 items-center gap-0.5 overflow-x-auto px-1">
			{#each tabs as tab (tab.id)}
				{@const TabIcon = TAB_ICONS[tab.type]}
				<div
					onclick={() => workspace.selectTab(tab.id, column)}
					onkeydown={(e) => e.key === 'Enter' && workspace.selectTab(tab.id, column)}
					role="tab"
					tabindex="0"
					aria-selected={activeTabId === tab.id}
					draggable="true"
					ondragstart={(e) => handleDragStart(e, tab)}
					class="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-sm transition-colors {activeTabId ===
					tab.id
						? 'bg-accent text-foreground'
						: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
				>
					<TabIcon class="h-3.5 w-3.5 shrink-0" />
					<span class="max-w-[120px] truncate">{tabTitle(tab)}</span>
					<button
						aria-label="Close tab"
						onclick={(e) => {
							e.stopPropagation();
							workspace.closeTab(tab.id, column);
						}}
						class="ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			{/each}

			<!-- New tab menu -->
			<div class="relative shrink-0">
				<button
					aria-label="New tab"
					onclick={() => (newMenuOpen = !newMenuOpen)}
					class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<Plus class="h-4 w-4" />
				</button>
				{#if newMenuOpen}
					<button
						class="fixed inset-0 z-40 cursor-default"
						aria-label="Close menu"
						onclick={() => (newMenuOpen = false)}
					></button>
					<div
						class="absolute top-full left-0 z-50 mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-xl"
					>
						<button
							onclick={() => {
								newMenuOpen = false;
								onNewFile(column);
							}}
							class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
						>
							<FileText class="h-3.5 w-3.5" /> New file
						</button>
						<button
							onclick={() => {
								newMenuOpen = false;
								onNewThread(column);
							}}
							class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
						>
							<MessageSquare class="h-3.5 w-3.5" /> New chat
						</button>
					</div>
				{/if}
			</div>
		</div>

		{#if column === 'left' && workspace.rightPanelCollapsed && !workspace.singleColumn}
			<button
				onclick={() => workspace.toggleRightPanel()}
				class="shrink-0 border-l border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Open right panel"
			>
				<PanelRightOpen class="h-4 w-4" />
			</button>
		{/if}

		{#if showClosePanel}
			<button
				onclick={() => workspace.collapseRightPanel()}
				class="shrink-0 border-l border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Close panel"
			>
				<PanelRightClose class="h-4 w-4" />
			</button>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-hidden">
		{#if tabs.length === 0}
			<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<p class="text-sm">No tabs open</p>
				<p class="text-xs">Use + or the sidebar to open files, chats, and sources</p>
			</div>
		{:else if activeTabId}
			{@const activeTab = tabs.find((t) => t.id === activeTabId)}
			{#if activeTab?.type === 'thread' && thread}
				{@render thread({ activeTabId })}
			{:else if activeTab?.type === 'artifact' && artifact}
				{@render artifact({ activeTabId })}
			{:else if activeTab?.type === 'source' && source}
				{@render source({ activeTabId })}
			{/if}
		{/if}
	</div>
</div>
