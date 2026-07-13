// Tab/pane state of the open project (port of SvelteReader's
// synthWorkspaceStore): two tabbed columns; new items open right when the
// left column is occupied, unless the user collapsed the right panel or
// we're on a small screen (singleColumn). Tab arrangement persists per
// project (kv `workspace-state:<id>`); sidebar/split geometry persists
// per npub (kv `workspace-layout`).

import { db } from '$lib/db/index.js';
import type { LayoutState, TabItem, TabType, WorkspaceState } from '$lib/db/types.js';

const DEFAULT_LAYOUT: LayoutState = { sidebarWidth: 240, sidebarCollapsed: false, splitRatio: 0.5 };

let projectId: string | null = null;
let leftTabs = $state<TabItem[]>([]);
let rightTabs = $state<TabItem[]>([]);
let activeLeftTabId = $state<string | null>(null);
let activeRightTabId = $state<string | null>(null);
let rightPanelCollapsed = $state(true);
// After the user explicitly collapses the right panel, new items keep
// opening left until they reopen it.
let forceSingleColumn = $state(false);
// Small screens: the view sets this; everything opens in the left column.
let singleColumn = $state(false);

let layout = $state<LayoutState>({ ...DEFAULT_LAYOUT });

function persistState(): void {
	if (!projectId) return;
	const state: WorkspaceState = {
		leftTabs: $state.snapshot(leftTabs),
		rightTabs: $state.snapshot(rightTabs),
		activeLeftTabId,
		activeRightTabId,
		rightPanelCollapsed
	};
	void db.kv.save(`workspace-state:${projectId}`, state);
}

function persistLayout(): void {
	void db.kv.save('workspace-layout', $state.snapshot(layout));
}

/**
 * Open a project's saved tab arrangement. `validIds` (the project's loaded
 * artifact/thread/source ids) prunes tabs whose items were deleted.
 */
async function load(id: string, validIds: Set<string>): Promise<void> {
	projectId = id;
	const saved = await db.kv.get<WorkspaceState>(`workspace-state:${id}`);
	leftTabs = (saved?.leftTabs ?? []).filter((t) => validIds.has(t.id));
	rightTabs = (saved?.rightTabs ?? []).filter((t) => validIds.has(t.id));
	activeLeftTabId =
		saved?.activeLeftTabId && leftTabs.some((t) => t.id === saved.activeLeftTabId)
			? saved.activeLeftTabId
			: (leftTabs.at(-1)?.id ?? null);
	activeRightTabId =
		saved?.activeRightTabId && rightTabs.some((t) => t.id === saved.activeRightTabId)
			? saved.activeRightTabId
			: (rightTabs.at(-1)?.id ?? null);
	rightPanelCollapsed = saved?.rightPanelCollapsed ?? rightTabs.length === 0;
	forceSingleColumn = false;

	// Single-column (mobile): saved right-column tabs would be unreachable.
	if (singleColumn && rightTabs.length > 0) {
		leftTabs = [...leftTabs, ...rightTabs];
		rightTabs = [];
		if (!activeLeftTabId) activeLeftTabId = activeRightTabId;
		activeRightTabId = null;
		rightPanelCollapsed = true;
	}

	layout = { ...DEFAULT_LAYOUT, ...(await db.kv.get<LayoutState>('workspace-layout')) };
}

function reset(): void {
	projectId = null;
	leftTabs = [];
	rightTabs = [];
	activeLeftTabId = null;
	activeRightTabId = null;
	rightPanelCollapsed = true;
	forceSingleColumn = false;
}

function openItem(id: string, type: TabType, targetColumn?: 'left' | 'right'): void {
	if (singleColumn) targetColumn = 'left';

	// Already open in the requested column → just focus it.
	if (targetColumn === 'left' && leftTabs.some((t) => t.id === id)) {
		activeLeftTabId = id;
		persistState();
		return;
	}
	if (targetColumn === 'right' && rightTabs.some((t) => t.id === id)) {
		activeRightTabId = id;
		rightPanelCollapsed = false;
		forceSingleColumn = false;
		persistState();
		return;
	}

	// Open in the OTHER column with an explicit target → move it over.
	if (targetColumn === 'left' && rightTabs.some((t) => t.id === id)) {
		moveTab(id, 'right', 'left');
		return;
	}
	if (targetColumn === 'right' && leftTabs.some((t) => t.id === id)) {
		moveTab(id, 'left', 'right');
		return;
	}

	// No target: focus wherever it is, else pick a sensible column.
	if (!targetColumn) {
		if (leftTabs.some((t) => t.id === id)) {
			activeLeftTabId = id;
			persistState();
			return;
		}
		if (rightTabs.some((t) => t.id === id)) {
			activeRightTabId = id;
			rightPanelCollapsed = false;
			forceSingleColumn = false;
			persistState();
			return;
		}
		targetColumn = leftTabs.length === 0 || forceSingleColumn ? 'left' : 'right';
	}

	const item: TabItem = { id, type };
	if (targetColumn === 'left') {
		leftTabs = [...leftTabs, item];
		activeLeftTabId = id;
	} else {
		rightTabs = [...rightTabs, item];
		activeRightTabId = id;
		rightPanelCollapsed = false;
		forceSingleColumn = false;
	}
	persistState();
}

function selectTab(id: string, column: 'left' | 'right'): void {
	if (column === 'left') activeLeftTabId = id;
	else activeRightTabId = id;
	persistState();
}

function closeTab(id: string, column: 'left' | 'right'): void {
	if (column === 'left') {
		leftTabs = leftTabs.filter((t) => t.id !== id);
		if (activeLeftTabId === id) activeLeftTabId = leftTabs.at(-1)?.id ?? null;
	} else {
		rightTabs = rightTabs.filter((t) => t.id !== id);
		if (activeRightTabId === id) activeRightTabId = rightTabs.at(-1)?.id ?? null;
	}
	persistState();
}

/** Close an item wherever it is (deleted in the sidebar, etc.). */
function closeItemGlobally(id: string): void {
	if (leftTabs.some((t) => t.id === id)) closeTab(id, 'left');
	if (rightTabs.some((t) => t.id === id)) closeTab(id, 'right');
}

function moveTab(id: string, from: 'left' | 'right', to: 'left' | 'right'): void {
	if (from === to) return;
	const tab = (from === 'left' ? leftTabs : rightTabs).find((t) => t.id === id);
	if (!tab) return;
	closeTab(id, from);
	if (to === 'left') {
		leftTabs = [...leftTabs, tab];
		activeLeftTabId = id;
	} else {
		rightTabs = [...rightTabs, tab];
		activeRightTabId = id;
		rightPanelCollapsed = false;
		forceSingleColumn = false;
	}
	persistState();
}

/** Close the right panel, folding its tabs into the left column. */
function collapseRightPanel(): void {
	leftTabs = [...leftTabs, ...rightTabs];
	if (!activeLeftTabId && activeRightTabId) activeLeftTabId = activeRightTabId;
	rightTabs = [];
	activeRightTabId = null;
	rightPanelCollapsed = true;
	forceSingleColumn = true;
	persistState();
}

function toggleRightPanel(): void {
	rightPanelCollapsed = !rightPanelCollapsed;
	if (!rightPanelCollapsed) forceSingleColumn = false;
	persistState();
}

export const workspace = {
	get leftTabs() {
		return leftTabs;
	},
	get rightTabs() {
		return rightTabs;
	},
	get activeLeftTabId() {
		return activeLeftTabId;
	},
	get activeRightTabId() {
		return activeRightTabId;
	},
	get rightPanelCollapsed() {
		return rightPanelCollapsed;
	},
	get singleColumn() {
		return singleColumn;
	},
	set singleColumn(value: boolean) {
		singleColumn = value;
	},
	get layout() {
		return layout;
	},
	setSidebarWidth(width: number) {
		layout.sidebarWidth = width;
		persistLayout();
	},
	toggleSidebar() {
		layout.sidebarCollapsed = !layout.sidebarCollapsed;
		persistLayout();
	},
	setSplitRatio(ratio: number) {
		layout.splitRatio = Math.max(0.2, Math.min(0.8, ratio));
		persistLayout();
	},
	load,
	reset,
	openItem,
	selectTab,
	closeTab,
	closeItemGlobally,
	moveTab,
	collapseRightPanel,
	toggleRightPanel
};
