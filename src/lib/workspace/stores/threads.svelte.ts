// Chat threads of the open project. The verbatim pi transcript lives in a
// separate TranscriptRecord (loaded on demand); this list is metadata only.
// Agent runners attach in Phase 4.

import { nanoid } from 'nanoid';
import { db } from '$lib/db/index.js';
import type { WorkspaceThread } from '$lib/db/types.js';
import { projects } from './projects.svelte.js';

let list = $state<WorkspaceThread[]>([]);
let projectId: string | null = null;

const sorted = $derived([...list].sort((a, b) => b.updatedAt - a.updatedAt));

async function load(id: string): Promise<void> {
	projectId = id;
	list = await db.workspaceThreads.getByProject(id);
}

function reset(): void {
	projectId = null;
	list = [];
}

function get(id: string): WorkspaceThread | undefined {
	return list.find((t) => t.id === id);
}

async function create(title = 'New Chat'): Promise<WorkspaceThread | null> {
	if (!projectId) return null;
	const now = Date.now();
	const thread: WorkspaceThread = {
		id: `wsthread-${nanoid()}`,
		projectId,
		title,
		createdAt: now,
		updatedAt: now
	};
	list.push(thread);
	await db.workspaceThreads.save($state.snapshot(thread));
	void projects.touch(projectId);
	return thread;
}

async function save(thread: WorkspaceThread): Promise<void> {
	thread.updatedAt = Date.now();
	await db.workspaceThreads.save($state.snapshot(thread));
}

async function remove(id: string): Promise<void> {
	list = list.filter((t) => t.id !== id);
	await db.workspaceThreads.delete(id); // cascades to the transcript
}

export const wsThreads = {
	get all() {
		return sorted;
	},
	get,
	load,
	reset,
	create,
	save,
	remove
};
