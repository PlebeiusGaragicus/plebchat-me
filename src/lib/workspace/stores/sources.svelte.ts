// Sources of the open project: saved reference documents (markdown), added
// manually for now — agent-driven scraping joins in Phase 4.

import { nanoid } from 'nanoid';
import { db } from '$lib/db/index.js';
import type { Source } from '$lib/db/types.js';
import { projects } from './projects.svelte.js';

let list = $state<Source[]>([]);
let projectId: string | null = null;

async function load(id: string): Promise<void> {
	projectId = id;
	list = await db.sources.getByProject(id);
}

function reset(): void {
	projectId = null;
	list = [];
}

function get(id: string): Source | undefined {
	return list.find((s) => s.id === id);
}

async function create(
	fields: Pick<Source, 'title' | 'url' | 'content'> & Partial<Source>
): Promise<Source | null> {
	if (!projectId) return null;
	const now = Date.now();
	const source: Source = {
		provider: 'manual',
		...fields,
		id: `source-${nanoid()}`,
		projectId,
		createdAt: now,
		updatedAt: now
	};
	list.push(source);
	await db.sources.save($state.snapshot(source));
	void projects.touch(projectId);
	return source;
}

async function remove(id: string): Promise<void> {
	list = list.filter((s) => s.id !== id);
	await db.sources.delete(id);
}

export const sources = {
	get all() {
		return list;
	},
	get,
	load,
	reset,
	create,
	remove
};
