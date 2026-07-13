// Workspace projects: the top-level entity of the Synthesize/Debate shared
// core. Holds the project list plus per-project artifact counts for the
// dashboard cards. Local-first — no sync (see docs/proposals/synthesize-mode.md).

import { nanoid } from 'nanoid';
import { db } from '$lib/db/index.js';
import type { Project } from '$lib/db/types.js';

let list = $state<Project[]>([]);
let artifactCounts = $state<Record<string, number>>({});
let activeId = $state<string | null>(null);
let ready = $state(false);

const sorted = $derived([...list].sort((a, b) => b.updatedAt - a.updatedAt));
const active = $derived(list.find((p) => p.id === activeId) ?? null);

async function init(): Promise<void> {
	const [projects, artifacts] = await Promise.all([db.projects.getAll(), db.artifacts.getAll()]);
	list = projects;
	const counts: Record<string, number> = {};
	for (const a of artifacts) counts[a.projectId] = (counts[a.projectId] ?? 0) + 1;
	artifactCounts = counts;
	ready = true;
}

function reset(): void {
	list = [];
	artifactCounts = {};
	activeId = null;
	ready = false;
}

async function create(title: string): Promise<Project> {
	const now = Date.now();
	const project: Project = {
		id: `proj-${nanoid()}`,
		title,
		tags: [],
		createdAt: now,
		updatedAt: now
	};
	list.push(project);
	await db.projects.save($state.snapshot(project));
	return project;
}

async function rename(id: string, title: string): Promise<void> {
	const project = list.find((p) => p.id === id);
	if (!project || !title.trim()) return;
	project.title = title.trim();
	project.updatedAt = Date.now();
	await db.projects.save($state.snapshot(project));
}

/** Bump updatedAt — call when anything inside the project changes. */
async function touch(id: string): Promise<void> {
	const project = list.find((p) => p.id === id);
	if (!project) return;
	project.updatedAt = Date.now();
	await db.projects.save($state.snapshot(project));
}

async function remove(id: string): Promise<void> {
	list = list.filter((p) => p.id !== id);
	delete artifactCounts[id];
	if (activeId === id) activeId = null;
	await db.projects.delete(id);
}

export const projects = {
	get ready() {
		return ready;
	},
	get all() {
		return sorted;
	},
	get active() {
		return active;
	},
	get activeId() {
		return activeId;
	},
	set activeId(id: string | null) {
		activeId = id;
	},
	artifactCount(id: string): number {
		return artifactCounts[id] ?? 0;
	},
	init,
	reset,
	create,
	rename,
	touch,
	remove
};
