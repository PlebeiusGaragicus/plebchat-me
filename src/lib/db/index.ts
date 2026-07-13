// IndexedDB persistence, one database per nostr identity, shared by all modes.
//
// The database name embeds the npub (`plebchat::<npub>`), so identity
// isolation is structural: there is no per-query npub filter to forget, logout
// is just closing the connection, and "delete my data" is deleteDatabase.
// `setCurrentUser(npub)` must be called (at login) before any other operation.
//
// Deliberately a FRESH database (not vibereader's `vibereader::<npub>`, which
// lives on this same origin): two live apps sharing one DB with divergent
// version counters is a corruption vector. Relay sync repopulates state; a
// one-time migration assistant copies book-file Blobs from the old DB.
//
// Future modes add their stores here via DB_VERSION bumps.

import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb';
import { KIND_ANNOTATION, KIND_BOOK, KIND_PROGRESS } from '$lib/read/nostr/kinds.js';
import type {
	Annotation,
	Artifact,
	Book,
	BookFile,
	ChatThread,
	Cover,
	LocationsCache,
	Project,
	ReadingProgress,
	SearchThread,
	Source,
	Tombstone,
	TranscriptRecord,
	WorkspaceThread
} from './types.js';

const DB_PREFIX = 'plebchat';
const DB_VERSION = 3;

interface PlebChatDB extends DBSchema {
	books: {
		key: string; // sha256
		value: Book;
		indexes: { 'by-added': number; 'by-lastOpened': number };
	};
	bookFiles: {
		key: string; // sha256
		value: BookFile;
	};
	covers: {
		key: string; // sha256
		value: Cover;
	};
	locations: {
		key: string; // sha256
		value: LocationsCache;
	};
	progress: {
		key: string; // sha256
		value: ReadingProgress;
	};
	annotations: {
		key: string; // anno-<nanoid>
		value: Annotation;
		indexes: { 'by-book': string; 'by-updated': number };
	};
	chats: {
		key: string;
		value: ChatThread;
		indexes: { 'by-book': string; 'by-updated': number };
	};
	searchThreads: {
		key: string; // search-<nanoid>
		value: SearchThread;
		indexes: { 'by-updated': number };
	};
	projects: {
		key: string; // proj-<nanoid>
		value: Project;
		indexes: { 'by-updated': number };
	};
	workspaceThreads: {
		key: string; // wsthread-<nanoid>
		value: WorkspaceThread;
		indexes: { 'by-project': string };
	};
	transcripts: {
		key: string; // threadId
		value: TranscriptRecord;
		indexes: { 'by-project': string };
	};
	artifacts: {
		key: string; // artifact-<nanoid>
		value: Artifact;
		indexes: { 'by-project': string };
	};
	sources: {
		key: string; // source-<nanoid>
		value: Source;
		indexes: { 'by-project': string };
	};
	kv: {
		key: string;
		value: { key: string; value: unknown };
	};
	tombstones: {
		key: string; // `<kind>:<d-tag>`
		value: Tombstone;
	};
}

let currentNpub: string | null = null;
let dbPromise: Promise<IDBPDatabase<PlebChatDB>> | null = null;

function dbName(npub: string): string {
	return `${DB_PREFIX}::${npub}`;
}

export function setCurrentUser(npub: string): void {
	if (currentNpub === npub) return;
	closeUserDB();
	currentNpub = npub;
}

/** Eagerly open the current user's DB (login-time), so schema upgrades and
 * version errors surface immediately instead of on the first data access. */
export async function openUserDB(): Promise<void> {
	await getDB();
}

export function closeUserDB(): void {
	if (dbPromise) {
		void dbPromise.then((db) => db.close()).catch(() => {});
	}
	dbPromise = null;
	currentNpub = null;
}

export async function deleteUserData(npub: string): Promise<void> {
	if (currentNpub === npub) closeUserDB();
	await deleteDB(dbName(npub));
}

function getDB(): Promise<IDBPDatabase<PlebChatDB>> {
	if (!currentNpub) {
		return Promise.reject(new Error('No user set — call setCurrentUser(npub) after login.'));
	}
	if (!dbPromise) {
		dbPromise = openDB<PlebChatDB>(dbName(currentNpub), DB_VERSION, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					const books = db.createObjectStore('books', { keyPath: 'sha256' });
					books.createIndex('by-added', 'addedAt');
					books.createIndex('by-lastOpened', 'lastOpenedAt');

					db.createObjectStore('bookFiles', { keyPath: 'sha256' });
					db.createObjectStore('covers', { keyPath: 'sha256' });
					db.createObjectStore('locations', { keyPath: 'sha256' });
					db.createObjectStore('progress', { keyPath: 'sha256' });

					const annotations = db.createObjectStore('annotations', { keyPath: 'id' });
					annotations.createIndex('by-book', 'sha256');
					annotations.createIndex('by-updated', 'updatedAt');

					const chats = db.createObjectStore('chats', { keyPath: 'id' });
					chats.createIndex('by-book', 'sha256');
					chats.createIndex('by-updated', 'updatedAt');

					db.createObjectStore('kv', { keyPath: 'key' });
					db.createObjectStore('tombstones', { keyPath: 'key' });
				}
				if (oldVersion < 2) {
					// v2: Search mode research threads (device-local pi transcripts).
					const searchThreads = db.createObjectStore('searchThreads', { keyPath: 'id' });
					searchThreads.createIndex('by-updated', 'updatedAt');
				}
				if (oldVersion < 3) {
					// v3: the workspace core (Synthesize/Debate) — projects with
					// threads, verbatim transcripts, versioned artifacts, sources.
					const projects = db.createObjectStore('projects', { keyPath: 'id' });
					projects.createIndex('by-updated', 'updatedAt');
					for (const name of ['workspaceThreads', 'artifacts', 'sources'] as const) {
						const store = db.createObjectStore(name, { keyPath: 'id' });
						store.createIndex('by-project', 'projectId');
					}
					const transcripts = db.createObjectStore('transcripts', { keyPath: 'threadId' });
					transcripts.createIndex('by-project', 'projectId');
				}
			}
		});
	}
	return dbPromise;
}

/** Svelte $state proxies can't be structured-cloned; strip them before put. */
function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

// ---- books ----

async function getAllBooks(): Promise<Book[]> {
	return (await getDB()).getAll('books');
}

async function getBook(sha256: string): Promise<Book | undefined> {
	return (await getDB()).get('books', sha256);
}

async function saveBook(book: Book): Promise<void> {
	await (await getDB()).put('books', clone(book));
}

/**
 * Cascade-delete a book and everything under it in one transaction, leaving
 * tombstones so the deletion propagates on the next sync (never resurrects).
 */
async function deleteBookCascade(sha256: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(
		['books', 'bookFiles', 'covers', 'locations', 'progress', 'annotations', 'chats', 'tombstones'],
		'readwrite'
	);
	const deletedAt = Date.now();
	const tombstones = tx.objectStore('tombstones');

	for (const store of ['annotations', 'chats'] as const) {
		const index = tx.objectStore(store).index('by-book');
		let cursor = await index.openCursor(IDBKeyRange.only(sha256));
		while (cursor) {
			if (store === 'annotations') {
				const d = String(cursor.primaryKey);
				await tombstones.put({ key: `${KIND_ANNOTATION}:${d}`, kind: KIND_ANNOTATION, d, deletedAt });
			}
			await cursor.delete();
			cursor = await cursor.continue();
		}
	}

	for (const store of ['bookFiles', 'covers', 'locations', 'progress', 'books'] as const) {
		await tx.objectStore(store).delete(sha256);
	}
	for (const kind of [KIND_BOOK, KIND_PROGRESS]) {
		await tombstones.put({ key: `${kind}:${sha256}`, kind, d: sha256, deletedAt });
	}
	await tx.done;
}

// ---- blobs (raw put/get — Blob payloads must NOT go through clone()) ----

async function getBookFile(sha256: string): Promise<BookFile | undefined> {
	return (await getDB()).get('bookFiles', sha256);
}

async function saveBookFile(record: BookFile): Promise<void> {
	await (await getDB()).put('bookFiles', record);
}

async function getCover(sha256: string): Promise<Cover | undefined> {
	return (await getDB()).get('covers', sha256);
}

async function saveCover(record: Cover): Promise<void> {
	await (await getDB()).put('covers', record);
}

/** Import writes metadata + bytes + cover atomically (blobs stay un-cloned). */
async function importBook(book: Book, file: BookFile, cover?: Cover): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(['books', 'bookFiles', 'covers'], 'readwrite');
	await tx.objectStore('books').put(clone(book));
	await tx.objectStore('bookFiles').put(file);
	if (cover) await tx.objectStore('covers').put(cover);
	await tx.done;
}

// ---- locations / progress ----

async function getLocations(sha256: string): Promise<LocationsCache | undefined> {
	return (await getDB()).get('locations', sha256);
}

async function saveLocations(record: LocationsCache): Promise<void> {
	await (await getDB()).put('locations', clone(record));
}

async function getProgress(sha256: string): Promise<ReadingProgress | undefined> {
	return (await getDB()).get('progress', sha256);
}

async function getAllProgress(): Promise<ReadingProgress[]> {
	return (await getDB()).getAll('progress');
}

async function saveProgress(record: ReadingProgress): Promise<void> {
	await (await getDB()).put('progress', clone(record));
}

// ---- annotations ----

async function getBookAnnotations(sha256: string): Promise<Annotation[]> {
	return (await getDB()).getAllFromIndex('annotations', 'by-book', sha256);
}

async function getAllAnnotations(): Promise<Annotation[]> {
	return (await getDB()).getAll('annotations');
}

async function saveAnnotation(annotation: Annotation): Promise<void> {
	await (await getDB()).put('annotations', clone(annotation));
}

async function deleteAnnotation(id: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(['annotations', 'tombstones'], 'readwrite');
	await tx
		.objectStore('tombstones')
		.put({ key: `${KIND_ANNOTATION}:${id}`, kind: KIND_ANNOTATION, d: id, deletedAt: Date.now() });
	await tx.objectStore('annotations').delete(id);
	await tx.done;
}

// ---- tombstones ----

async function getAllTombstones(): Promise<Tombstone[]> {
	return (await getDB()).getAll('tombstones');
}

async function saveTombstone(record: Tombstone): Promise<void> {
	await (await getDB()).put('tombstones', clone(record));
}

async function getTombstone(kind: number, d: string): Promise<Tombstone | undefined> {
	return (await getDB()).get('tombstones', `${kind}:${d}`);
}

// ---- chats ----

async function getBookChats(sha256: string): Promise<ChatThread[]> {
	return (await getDB()).getAllFromIndex('chats', 'by-book', sha256);
}

async function saveChat(thread: ChatThread): Promise<void> {
	await (await getDB()).put('chats', clone(thread));
}

async function deleteChat(id: string): Promise<void> {
	await (await getDB()).delete('chats', id);
}

// ---- search threads ----

async function getAllSearchThreads(): Promise<SearchThread[]> {
	return (await getDB()).getAll('searchThreads');
}

async function saveSearchThread(thread: SearchThread): Promise<void> {
	await (await getDB()).put('searchThreads', clone(thread));
}

async function deleteSearchThread(id: string): Promise<void> {
	await (await getDB()).delete('searchThreads', id);
}

// ---- workspace (projects / threads / transcripts / artifacts / sources) ----

async function getAllProjects(): Promise<Project[]> {
	return (await getDB()).getAll('projects');
}

async function getProject(id: string): Promise<Project | undefined> {
	return (await getDB()).get('projects', id);
}

async function saveProject(project: Project): Promise<void> {
	await (await getDB()).put('projects', clone(project));
}

/**
 * Cascade-delete a project and everything under it in one transaction. No
 * tombstones: workspace entities are local-first, outside the sync schema
 * (revisited with the Debate-mode event-kind decision).
 */
async function deleteProjectCascade(id: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(
		['projects', 'workspaceThreads', 'transcripts', 'artifacts', 'sources', 'kv'],
		'readwrite'
	);
	for (const store of ['workspaceThreads', 'transcripts', 'artifacts', 'sources'] as const) {
		const index = tx.objectStore(store).index('by-project');
		let cursor = await index.openCursor(IDBKeyRange.only(id));
		while (cursor) {
			await cursor.delete();
			cursor = await cursor.continue();
		}
	}
	await tx.objectStore('kv').delete(`workspace-state:${id}`);
	await tx.objectStore('projects').delete(id);
	await tx.done;
}

async function getProjectThreads(projectId: string): Promise<WorkspaceThread[]> {
	return (await getDB()).getAllFromIndex('workspaceThreads', 'by-project', projectId);
}

async function saveWorkspaceThread(thread: WorkspaceThread): Promise<void> {
	await (await getDB()).put('workspaceThreads', clone(thread));
}

async function deleteWorkspaceThread(id: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(['workspaceThreads', 'transcripts'], 'readwrite');
	await tx.objectStore('workspaceThreads').delete(id);
	await tx.objectStore('transcripts').delete(id);
	await tx.done;
}

async function getTranscript(threadId: string): Promise<TranscriptRecord | undefined> {
	return (await getDB()).get('transcripts', threadId);
}

async function saveTranscript(record: TranscriptRecord): Promise<void> {
	await (await getDB()).put('transcripts', clone(record));
}

async function getAllArtifacts(): Promise<Artifact[]> {
	return (await getDB()).getAll('artifacts');
}

async function getProjectArtifacts(projectId: string): Promise<Artifact[]> {
	return (await getDB()).getAllFromIndex('artifacts', 'by-project', projectId);
}

async function getArtifact(id: string): Promise<Artifact | undefined> {
	return (await getDB()).get('artifacts', id);
}

async function saveArtifact(artifact: Artifact): Promise<void> {
	await (await getDB()).put('artifacts', clone(artifact));
}

async function deleteArtifact(id: string): Promise<void> {
	await (await getDB()).delete('artifacts', id);
}

async function getProjectSources(projectId: string): Promise<Source[]> {
	return (await getDB()).getAllFromIndex('sources', 'by-project', projectId);
}

async function getSource(id: string): Promise<Source | undefined> {
	return (await getDB()).get('sources', id);
}

async function saveSource(source: Source): Promise<void> {
	await (await getDB()).put('sources', clone(source));
}

async function deleteSource(id: string): Promise<void> {
	await (await getDB()).delete('sources', id);
}

// ---- kv ----

async function getKV<T>(key: string): Promise<T | undefined> {
	const entry = await (await getDB()).get('kv', key);
	return entry?.value as T | undefined;
}

async function saveKV(key: string, value: unknown): Promise<void> {
	await (await getDB()).put('kv', { key, value: clone(value) });
}

export const db = {
	books: {
		getAll: getAllBooks,
		get: getBook,
		save: saveBook,
		import: importBook,
		delete: deleteBookCascade
	},
	bookFiles: {
		get: getBookFile,
		save: saveBookFile
	},
	covers: {
		get: getCover,
		save: saveCover
	},
	locations: {
		get: getLocations,
		save: saveLocations
	},
	progress: {
		get: getProgress,
		getAll: getAllProgress,
		save: saveProgress
	},
	annotations: {
		getAll: getAllAnnotations,
		getByBook: getBookAnnotations,
		save: saveAnnotation,
		delete: deleteAnnotation
	},
	chats: {
		getByBook: getBookChats,
		save: saveChat,
		delete: deleteChat
	},
	searchThreads: {
		getAll: getAllSearchThreads,
		save: saveSearchThread,
		delete: deleteSearchThread
	},
	projects: {
		getAll: getAllProjects,
		get: getProject,
		save: saveProject,
		delete: deleteProjectCascade
	},
	workspaceThreads: {
		getByProject: getProjectThreads,
		save: saveWorkspaceThread,
		delete: deleteWorkspaceThread
	},
	transcripts: {
		get: getTranscript,
		save: saveTranscript
	},
	artifacts: {
		getAll: getAllArtifacts,
		getByProject: getProjectArtifacts,
		get: getArtifact,
		save: saveArtifact,
		delete: deleteArtifact
	},
	sources: {
		getByProject: getProjectSources,
		get: getSource,
		save: saveSource,
		delete: deleteSource
	},
	kv: {
		get: getKV,
		save: saveKV
	},
	tombstones: {
		getAll: getAllTombstones,
		get: getTombstone,
		save: saveTombstone
	}
};
