// Artifacts of the open project: versioned markdown files. Phase 2 edits the
// current version in place; version snapshots (new entries in versions[])
// arrive with the editor in Phase 3 and agent patches in Phase 4.

import { nanoid } from 'nanoid';
import { db } from '$lib/db/index.js';
import type { Artifact } from '$lib/db/types.js';
import { projects } from './projects.svelte.js';

let list = $state<Artifact[]>([]);
let projectId: string | null = null;

async function load(id: string): Promise<void> {
	projectId = id;
	list = await db.artifacts.getByProject(id);
}

function reset(): void {
	projectId = null;
	list = [];
}

function get(id: string): Artifact | undefined {
	return list.find((a) => a.id === id);
}

/** The live title/content of an artifact — its current version. */
function currentVersion(id: string) {
	const artifact = get(id);
	return artifact?.versions[artifact.currentVersionIndex];
}

async function create(title: string, content = ''): Promise<Artifact | null> {
	if (!projectId) return null;
	const now = Date.now();
	const artifact: Artifact = {
		id: `artifact-${nanoid()}`,
		projectId,
		currentVersionIndex: 0,
		versions: [{ index: 0, title, content, createdAt: now }],
		createdAt: now,
		updatedAt: now
	};
	list.push(artifact);
	await db.artifacts.save($state.snapshot(artifact));
	projects.bumpArtifactCount(projectId, 1);
	void projects.touch(projectId);
	return artifact;
}

async function save(artifact: Artifact): Promise<void> {
	artifact.updatedAt = Date.now();
	await db.artifacts.save($state.snapshot(artifact));
}

async function rename(id: string, title: string): Promise<void> {
	const version = currentVersion(id);
	const artifact = get(id);
	if (!artifact || !version || !title.trim()) return;
	version.title = title.trim();
	await save(artifact);
}

/** In-place content update of the current version (no snapshot). */
async function setContent(id: string, content: string): Promise<void> {
	const version = currentVersion(id);
	const artifact = get(id);
	if (!artifact || !version) return;
	version.content = content;
	await save(artifact);
}

async function remove(id: string): Promise<void> {
	const artifact = get(id);
	list = list.filter((a) => a.id !== id);
	await db.artifacts.delete(id);
	if (artifact) {
		projects.bumpArtifactCount(artifact.projectId, -1);
		void projects.touch(artifact.projectId);
	}
}

export const artifacts = {
	get all() {
		return list;
	},
	get,
	currentVersion,
	load,
	reset,
	create,
	save,
	rename,
	setContent,
	remove
};
