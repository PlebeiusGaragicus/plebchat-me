// Artifacts of the open project: versioned markdown files with a
// live-content editing layer (socratic-seminar's model).
//
// Editing is decoupled from persistence: the editor writes into liveContent
// (marking the artifact dirty); flush() reconciles live content into the
// current version and persists. Versions are explicit snapshots — autosaves
// (and later, agent patches) update the current version in place. Dirty
// state lives OUTSIDE the Artifact records so runtime state can never leak
// into IndexedDB.

import { nanoid } from 'nanoid';
import { untrack } from 'svelte';
import { db } from '$lib/db/index.js';
import type { Artifact, ArtifactVersion } from '$lib/db/types.js';
import { projects } from './projects.svelte.js';

let list = $state<Artifact[]>([]);
let liveContent = $state<Record<string, string>>({});
let dirtyIds = $state<string[]>([]);
let projectId: string | null = null;

function markDirty(id: string): void {
	if (!dirtyIds.includes(id)) dirtyIds = [...dirtyIds, id];
}

function clearDirty(id: string): void {
	dirtyIds = dirtyIds.filter((d) => d !== id);
}

async function load(id: string): Promise<void> {
	projectId = id;
	list = await db.artifacts.getByProject(id);
}

function reset(): void {
	projectId = null;
	list = [];
	liveContent = {};
	dirtyIds = [];
}

function get(id: string): Artifact | undefined {
	return list.find((a) => a.id === id);
}

/** The live title/content of an artifact — its current version. */
function currentVersion(id: string): ArtifactVersion | undefined {
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

/** Editor keystrokes land here; nothing is persisted until a flush. */
function updateLiveContent(id: string, content: string): void {
	liveContent[id] = content;
	markDirty(id);
}

/** Live (possibly unsaved) content, falling back to the stored current version. */
function getLiveContent(id: string): string | null {
	if (liveContent[id] !== undefined) return liveContent[id];
	return currentVersion(id)?.content ?? (get(id) ? '' : null);
}

/** Reconcile one artifact's live content into its current version and persist. */
async function flush(id: string): Promise<void> {
	const artifact = untrack(() => get(id));
	const content = untrack(() => liveContent[id]);
	if (!artifact || content === undefined) {
		clearDirty(id);
		return;
	}
	const current = artifact.versions[artifact.currentVersionIndex];
	if (!current || content === current.content) {
		clearDirty(id);
		return;
	}
	current.content = content;
	clearDirty(id);
	await save(artifact);
}

/** Flush every dirty artifact (project switch, unmount, beforeunload). */
async function flushAll(): Promise<void> {
	const ids = untrack(() => [...dirtyIds]);
	await Promise.all(ids.map((id) => flush(id)));
}

/** Snapshot the current (live) content as a new version and select it. */
async function snapshotVersion(id: string): Promise<void> {
	const artifact = get(id);
	const current = currentVersion(id);
	if (!artifact || !current) return;
	const content = untrack(() => liveContent[id]) ?? current.content;
	const version: ArtifactVersion = {
		index: artifact.versions.length,
		title: current.title,
		content,
		createdAt: Date.now()
	};
	artifact.versions.push(version);
	artifact.currentVersionIndex = version.index;
	delete liveContent[id];
	clearDirty(id);
	await save(artifact);
}

/** Navigate version history; discards unsaved live edits by design. */
async function setVersion(id: string, versionIndex: number): Promise<void> {
	const artifact = get(id);
	if (!artifact || versionIndex < 0 || versionIndex >= artifact.versions.length) return;
	artifact.currentVersionIndex = versionIndex;
	// The editor should show the newly selected version, not stale live edits.
	delete liveContent[id];
	clearDirty(id);
	await save(artifact);
}

async function remove(id: string): Promise<void> {
	const artifact = get(id);
	list = list.filter((a) => a.id !== id);
	delete liveContent[id];
	clearDirty(id);
	await db.artifacts.delete(id);
	if (artifact) {
		projects.bumpArtifactCount(artifact.projectId, -1);
		void projects.touch(artifact.projectId);
	}
}

/** Find an artifact by its current-version title (for [[Title]] links). */
function findByTitle(title: string): Artifact | undefined {
	const wanted = title.trim().toLowerCase();
	return list.find(
		(a) => (a.versions[a.currentVersionIndex]?.title ?? '').trim().toLowerCase() === wanted
	);
}

export const artifacts = {
	get all() {
		return list;
	},
	get dirtyIds() {
		return dirtyIds;
	},
	get,
	currentVersion,
	findByTitle,
	load,
	reset,
	create,
	save,
	rename,
	updateLiveContent,
	getLiveContent,
	flush,
	flushAll,
	snapshotVersion,
	setVersion,
	remove
};
