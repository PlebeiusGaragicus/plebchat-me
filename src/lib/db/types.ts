// The ONE canonical data shape — camelCase everywhere, mirrored 1:1 by the
// nostr event content schemas in docs/nostr-event-model.md. Timestamps are
// Unix ms. A book's identity is its EPUB file's sha256 (lowercase hex): the
// IndexedDB key, the Blossom address, and the nostr d-tag are all the
// same string.

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

/** Library metadata only — the grid never touches blobs. */
export interface Book {
	sha256: string;
	title: string;
	creator: string;
	publisher?: string;
	language?: string;
	isbn?: string;
	description?: string;
	fileSize: number;
	/** Blossom servers holding the (raw, public-by-hash) EPUB + cover. */
	blossom?: { servers: string[]; coverSha256?: string };
	/** On the user's public shelf: 30101 published as plaintext (still editable). */
	shared?: boolean;
	/** Never leaves this device: the book AND its progress/annotations are
	 * excluded from sync push/pull. Device-local flag — stripped from 30101
	 * drafts like lastOpenedAt (it never applies remotely by construction). */
	localOnly?: boolean;
	addedAt: number;
	updatedAt: number;
	lastOpenedAt?: number;
}

/** The EPUB bytes, stored raw (never JSON-cloned — that destroys Blobs). */
export interface BookFile {
	sha256: string;
	blob: Blob;
}

export interface Cover {
	sha256: string;
	blob: Blob;
	mimeType: string;
}

/** Cached epub.js `book.locations.save()` output — generating is slow. */
export interface LocationsCache {
	sha256: string;
	locationsJson: string;
	charsPerLocation: number;
	generatedAt: number;
}

export interface ReadingProgress {
	sha256: string;
	cfi: string;
	percentage: number; // 0–1
	sectionHref?: string;
	updatedAt: number;
}

/**
 * Unified annotation: highlight-only (color, no note), note-only (note, no
 * color), or both. Maps 1:1 onto kind-30104 event content.
 */
export interface Annotation {
	id: string; // `anno-<nanoid>` — the nostr d-tag
	sha256: string;
	cfiRange: string;
	quote: string;
	color?: HighlightColor;
	note?: string;
	/** Published as plaintext 30104 with query tags (still editable). */
	shared?: boolean;
	createdAt: number;
	updatedAt: number;
}

/**
 * Record of a propagated deletion: keeps local pushes from resurrecting a
 * record another device deleted, and drives the tombstone events we publish.
 */
export interface Tombstone {
	key: string; // `<kind>:<d-tag>`
	kind: number;
	d: string;
	deletedAt: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	createdAt: number;
}

/**
 * A source the Search agent consulted, recorded by tool execution (never by
 * the model's prose — the tool-built list is the authoritative record; `[s1]`
 * markers in the answer are presentation only).
 */
export interface SearchSource {
	id: string; // `s1`, `s2`, … — stable within the thread, cited as [s1]
	kind: 'web' | 'nostr';
	title: string;
	/** Web URL, or a nostr: URI for relay results. */
	url: string;
	description?: string;
	/** How the agent touched it: surfaced by search, or fully fetched. */
	fetched?: boolean;
	addedAt: number;
}

/**
 * Device-local research thread (Search mode). `messages` is the verbatim pi
 * AgentMessage transcript — persisted as-is so a thread rehydrates into the
 * agent runner; deliberately outside the sync schema like ChatThread.
 */
export interface SearchThread {
	id: string; // `search-<nanoid>`
	title: string;
	messages: unknown[];
	sources: SearchSource[];
	createdAt: number;
	updatedAt: number;
}

// ---- Workspace (the Synthesize/Debate shared core, $lib/workspace) ----
// Shapes adopted from socratic-seminar's db/types.ts (itself SvelteReader's
// synthesize model with the LangGraph fields stripped). Local-first; nostr
// sync is deferred to the shared event-kind decision with Debate mode.

export interface ProjectTag {
	name: string;
	color: string; // tailwind class, e.g. 'bg-red-500'
	deletable: boolean;
}

export interface Project {
	id: string; // `proj-<nanoid>`
	title: string;
	tags: ProjectTag[];
	createdAt: number;
	updatedAt: number;
}

/** Per-thread agent configuration (BYO endpoint settings live in localStorage). */
export interface AgentSettings {
	/** Overrides the global model id from settings when set. */
	model?: string;
}

/** A workspace chat thread (its pi transcript lives in TranscriptRecord). */
export interface WorkspaceThread {
	id: string; // `wsthread-<nanoid>`
	projectId: string;
	title: string;
	/** Preview line for lists — last message excerpt or summary. */
	description?: string;
	agentSettings?: AgentSettings;
	createdAt: number;
	updatedAt: number;
}

/**
 * One record per workspace thread: the pi agent transcript stored verbatim
 * (`AgentMessage[]` round-trips through the runner — never project it into a
 * lossy custom shape). Split from WorkspaceThread so lists never load
 * transcripts.
 */
export interface TranscriptRecord {
	threadId: string;
	projectId: string;
	messages: unknown[];
	updatedAt: number;
}

export interface ArtifactVersion {
	index: number;
	title: string;
	content: string; // markdown
	createdAt: number;
}

/** A versioned markdown document; the agent edits these via patch_file. */
export interface Artifact {
	id: string; // `artifact-<nanoid>`
	projectId: string;
	/** Points into versions[]; the current version holds the live title/content. */
	currentVersionIndex: number;
	versions: ArtifactVersion[];
	tags?: string[];
	createdAt: number;
	updatedAt: number;
}

export interface Bibliography {
	author?: string;
	publishedDate?: string; // ISO date
	publisher?: string;
	resourceType?: string; // e.g. 'Article'
}

/**
 * A saved reference document (web page scraped to markdown; file uploads are
 * a deferred follow-up). Read-only in the UI; the agent cites sources by
 * title. Distinct from SearchSource, which is a lightweight citation record
 * inside a Search thread — this carries the full content.
 */
export interface Source {
	id: string; // `source-<nanoid>`
	projectId: string;
	title: string;
	url: string;
	content: string; // markdown
	bibliography?: Bibliography;
	provider?: 'firecrawl' | 'manual';
	scrapedAt?: number;
	createdAt: number;
	updatedAt: number;
}

export type TabType = 'artifact' | 'thread' | 'source';

export interface TabItem {
	id: string;
	type: TabType;
}

/** Per-project pane/tab arrangement — kv key `workspace-state:<projectId>`. */
export interface WorkspaceState {
	leftTabs: TabItem[];
	rightTabs: TabItem[];
	activeLeftTabId: string | null;
	activeRightTabId: string | null;
	rightPanelCollapsed: boolean;
}

/** Global (per-npub, not per-project) workspace layout — kv key `workspace-layout`. */
export interface LayoutState {
	sidebarWidth: number;
	sidebarCollapsed: boolean;
	/** Left column fraction of the two-panel split (0.2–0.8). */
	splitRatio: number;
}

/** Device-local chat thread (deliberately not part of the sync schema). */
export interface ChatThread {
	id: string;
	sha256: string;
	title: string;
	context?: { cfiRange: string; quote: string };
	/**
	 * Optional link to an annotation, so a highlight can carry a conversation.
	 * The link lives HERE (device-local) and never on the annotation record —
	 * annotations mirror kind-30104 event content 1:1 and chats never sync, so
	 * the SvelteReader design (thread ids on the annotation) would have been a
	 * silent protocol change.
	 */
	annotationId?: string;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}
