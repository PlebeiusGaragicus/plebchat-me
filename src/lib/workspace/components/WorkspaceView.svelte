<script lang="ts">
	// Workspace for one open project (port of SvelteReader's WorkspaceLayout):
	// drag-resize collapsible sidebar (180–400px) + two tabbed columns with a
	// draggable divider (split persisted as a ratio). Below the `md`
	// breakpoint the sidebar becomes an overlay drawer and everything opens
	// in a single column.
	import { Menu, X } from '@lucide/svelte';
	import type { Project, TabType } from '$lib/db/types.js';
	import ArtifactPane from './ArtifactPane.svelte';
	import Sidebar from './Sidebar.svelte';
	import SourceViewer from './SourceViewer.svelte';
	import TabbedPanel from './TabbedPanel.svelte';
	import ThreadPane from './ThreadPane.svelte';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import { sources } from '../stores/sources.svelte.js';
	import { wsThreads } from '../stores/threads.svelte.js';
	import { workspace } from '../stores/workspace.svelte.js';

	interface Props {
		project: Project;
		onBack: () => void;
	}

	let { project, onBack }: Props = $props();

	// Plain variable, not $state: written inside the load effect below, and a
	// reactive write there would re-trigger the effect (and its teardown).
	let loadedProjectId: string | null = null;
	let container = $state<HTMLDivElement | undefined>();
	let isDraggingSidebar = $state(false);
	let isDraggingDivider = $state(false);
	let drawerOpen = $state(false);

	// Small screens: single column + drawer sidebar.
	let isMobile = $state(false);
	$effect(() => {
		const query = window.matchMedia('(max-width: 767px)');
		const apply = () => {
			isMobile = query.matches;
			workspace.singleColumn = query.matches;
			// Right-column tabs would be unreachable in single-column mode.
			if (query.matches && workspace.rightTabs.length > 0) workspace.collapseRightPanel();
		};
		apply();
		query.addEventListener('change', apply);
		return () => query.removeEventListener('change', apply);
	});

	// Load the project's items, then its saved tab arrangement (pruned to
	// items that still exist).
	$effect(() => {
		const id = project.id;
		if (loadedProjectId === id) return;
		loadedProjectId = id;
		void (async () => {
			await Promise.all([artifacts.load(id), wsThreads.load(id), sources.load(id)]);
			const validIds = new Set([
				...artifacts.all.map((a) => a.id),
				...wsThreads.all.map((t) => t.id),
				...sources.all.map((s) => s.id)
			]);
			await workspace.load(id, validIds);
		})();
	});

	// Unmount only (no reactive deps): flush unsaved edits (the editors'
	// onDestroy already flushed — belt and braces), then clear the
	// per-project stores. flush() captures its data synchronously, so the
	// resets can follow without racing the awaited db writes.
	$effect(() => {
		const flushPending = () => void artifacts.flushAll();
		window.addEventListener('beforeunload', flushPending);
		return () => {
			window.removeEventListener('beforeunload', flushPending);
			void artifacts.flushAll();
			artifacts.reset();
			wsThreads.reset();
			sources.reset();
			workspace.reset();
		};
	});

	function handleSelect(id: string, type: TabType) {
		workspace.openItem(id, type);
		drawerOpen = false;
	}

	async function handleNewFile(column: 'left' | 'right') {
		const artifact = await artifacts.create(`untitled-${Date.now().toString().slice(-4)}.md`);
		if (artifact) workspace.openItem(artifact.id, 'artifact', column);
	}

	async function handleNewThread(column: 'left' | 'right') {
		const thread = await wsThreads.create();
		if (thread) workspace.openItem(thread.id, 'thread', column);
	}

	// -- drag-resize: sidebar width and column split ------------------------

	function startSidebarDrag(e: MouseEvent) {
		e.preventDefault();
		isDraggingSidebar = true;
		const move = (ev: MouseEvent) => {
			const left = container?.getBoundingClientRect().left ?? 0;
			workspace.setSidebarWidth(Math.max(180, Math.min(400, ev.clientX - left)));
		};
		const up = () => {
			isDraggingSidebar = false;
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	}

	function startDividerDrag(e: MouseEvent) {
		e.preventDefault();
		isDraggingDivider = true;
		const move = (ev: MouseEvent) => {
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const sidebar = workspace.layout.sidebarCollapsed ? 48 : workspace.layout.sidebarWidth;
			const available = rect.width - sidebar;
			if (available > 0) {
				workspace.setSplitRatio((ev.clientX - rect.left - sidebar) / available);
			}
		};
		const up = () => {
			isDraggingDivider = false;
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
	}
</script>

{#snippet panes(column: 'left' | 'right', tabs: typeof workspace.leftTabs, activeTabId: string | null)}
	<TabbedPanel
		{column}
		{tabs}
		{activeTabId}
		onNewFile={handleNewFile}
		onNewThread={handleNewThread}
		showClosePanel={column === 'right'}
	>
		{#snippet thread(props)}
			<ThreadPane threadId={props.activeTabId} />
		{/snippet}
		{#snippet artifact(props)}
			<ArtifactPane artifactId={props.activeTabId} />
		{/snippet}
		{#snippet source(props)}
			<SourceViewer sourceId={props.activeTabId} />
		{/snippet}
	</TabbedPanel>
{/snippet}

<div bind:this={container} class="flex h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
	{#if isMobile}
		<!-- Drawer trigger rail -->
		<div class="flex w-10 shrink-0 flex-col items-center border-r border-border py-2">
			<button
				aria-label="Open project sidebar"
				onclick={() => (drawerOpen = true)}
				class="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<Menu class="h-5 w-5" />
			</button>
		</div>

		{#if drawerOpen}
			<div class="fixed inset-0 z-50 flex">
				<div class="w-72 max-w-[85vw] bg-background shadow-xl">
					<Sidebar
						{project}
						collapsed={false}
						onToggleCollapse={() => (drawerOpen = false)}
						onBackToProjects={onBack}
						onSelect={handleSelect}
					/>
				</div>
				<button
					aria-label="Close sidebar"
					class="flex-1 bg-black/50 backdrop-blur-sm"
					onclick={() => (drawerOpen = false)}
				>
					<X class="mx-auto h-5 w-5 text-white/70" />
				</button>
			</div>
		{/if}

		<div class="flex flex-1 flex-col overflow-hidden">
			{@render panes('left', workspace.leftTabs, workspace.activeLeftTabId)}
		</div>
	{:else}
		<!-- Sidebar -->
		<div
			class="shrink-0"
			style="width: {workspace.layout.sidebarCollapsed ? '48px' : `${workspace.layout.sidebarWidth}px`}"
		>
			<Sidebar
				{project}
				collapsed={workspace.layout.sidebarCollapsed}
				onToggleCollapse={() => workspace.toggleSidebar()}
				onBackToProjects={onBack}
				onSelect={handleSelect}
			/>
		</div>

		{#if !workspace.layout.sidebarCollapsed}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
				class="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 {isDraggingSidebar
					? 'bg-primary'
					: ''}"
				onmousedown={startSidebarDrag}
				role="separator"
				aria-orientation="vertical"
			></div>
		{/if}

		<!-- Columns -->
		<div class="flex flex-1 overflow-hidden">
			<div
				class="flex flex-col overflow-hidden"
				style="width: {workspace.rightPanelCollapsed
					? '100%'
					: `${workspace.layout.splitRatio * 100}%`}"
			>
				{@render panes('left', workspace.leftTabs, workspace.activeLeftTabId)}
			</div>

			{#if !workspace.rightPanelCollapsed}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 {isDraggingDivider
						? 'bg-primary'
						: ''}"
					onmousedown={startDividerDrag}
					role="separator"
					aria-orientation="vertical"
				></div>
				<div class="flex flex-1 flex-col overflow-hidden">
					{@render panes('right', workspace.rightTabs, workspace.activeRightTabId)}
				</div>
			{/if}
		</div>
	{/if}
</div>
