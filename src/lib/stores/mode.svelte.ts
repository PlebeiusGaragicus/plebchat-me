/**
 * Mode store — which "mode" PlebChat is in, persisted to localStorage.
 *
 * Each mode is a mini-app with its own route and functionality, sharing the
 * common shell (TopBar, cyphertap auth/wallet, theming).
 */

import { browser } from '$app/environment';
import { BookOpen, Search, FlaskConical, MessagesSquare } from '@lucide/svelte';
import type { Component } from 'svelte';

const STORAGE_KEY = 'plebchat-mode';

export type AppMode = 'read' | 'search' | 'synthesize' | 'debate';

export interface ModeInfo {
	id: AppMode;
	name: string;
	description: string;
	icon: Component<{ class?: string }>;
	// Literal route union so resolve(mode.route) type-checks against the route manifest
	route: `/${AppMode}`;
}

export const MODES: ModeInfo[] = [
	{
		id: 'read',
		name: 'Read',
		description: 'Read and annotate books and documents',
		icon: BookOpen,
		route: '/read'
	},
	{
		id: 'search',
		name: 'Search',
		description: 'Agentic research with cited answers',
		icon: Search,
		route: '/search'
	},
	{
		id: 'synthesize',
		name: 'Synthesize',
		description: 'Knowledge synthesis and document creation',
		icon: FlaskConical,
		route: '/synthesize'
	},
	{
		id: 'debate',
		name: 'Debate',
		description: 'Structured Socratic seminars with an agent',
		icon: MessagesSquare,
		route: '/debate'
	}
];

function isAppMode(value: string | null): value is AppMode {
	return MODES.some((m) => m.id === value);
}

function loadMode(): AppMode {
	if (!browser) return 'read';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (isAppMode(stored)) return stored;
	} catch (e) {
		console.error('Failed to load mode:', e);
	}
	return 'read';
}

function saveMode(mode: AppMode): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch (e) {
		console.error('Failed to save mode:', e);
	}
}

function createModeStore() {
	let currentMode = $state<AppMode>(loadMode());

	function setMode(mode: AppMode): void {
		currentMode = mode;
		saveMode(mode);
	}

	function getModeInfo(mode: AppMode): ModeInfo {
		return MODES.find((m) => m.id === mode) ?? MODES[0];
	}

	return {
		get current() {
			return currentMode;
		},
		get currentInfo() {
			return getModeInfo(currentMode);
		},
		get modes() {
			return MODES;
		},
		setMode,
		getModeInfo
	};
}

export const modeStore = createModeStore();
