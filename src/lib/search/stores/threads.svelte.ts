// Search-mode research threads: SearchThread records in the per-npub DB plus
// one AgentRunner per thread (lazily created, kept across thread switches so
// concurrent runs keep streaming). Device-local by design, like Read's chats.

import { nanoid } from 'nanoid';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { AgentRunner } from '$lib/ai/runner.svelte.js';
import { db } from '$lib/db/index.js';
import type { SearchSource, SearchThread } from '$lib/db/types.js';
import { buildSearchPrompt } from '../prompt.js';
import { buildSearchTools, searchCapabilities, type SourceRecorder } from '../tools.js';

let threads = $state<SearchThread[]>([]);
let activeId = $state<string | null>(null);
let ready = $state(false);

// Runners hold their own $state; the map itself needs no reactivity — the
// activeRunner derived re-evaluates on activeId changes and runnerFor lazily
// fills the map (no $state writes here: it runs inside a $derived).
const runners = new Map<string, AgentRunner>();

const sorted = $derived([...threads].sort((a, b) => b.updatedAt - a.updatedAt));
const active = $derived(threads.find((t) => t.id === activeId) ?? null);

async function init(): Promise<void> {
	threads = await db.searchThreads.getAll();
	ready = true;
}

function reset(): void {
	for (const runner of runners.values()) runner.dispose();
	runners.clear();
	threads = [];
	activeId = null;
	ready = false;
}

function create(): SearchThread {
	const now = Date.now();
	const thread: SearchThread = {
		id: `search-${nanoid()}`,
		title: 'New research',
		messages: [],
		sources: [],
		createdAt: now,
		updatedAt: now
	};
	threads.push(thread);
	activeId = thread.id;
	return thread;
}

/** Sources dedupe by URL; ids stay stable, so `s<n>` from length is unique. */
function recorderFor(threadId: string): SourceRecorder {
	return {
		record(source: Omit<SearchSource, 'id' | 'addedAt'>): SearchSource {
			const thread = threads.find((t) => t.id === threadId);
			if (!thread) {
				return { ...source, id: 's?', addedAt: Date.now() };
			}
			const existing = thread.sources.find((s) => s.url === source.url);
			if (existing) {
				if (source.fetched) existing.fetched = true;
				void saveThread(thread);
				return existing;
			}
			const recorded: SearchSource = {
				...source,
				id: `s${thread.sources.length + 1}`,
				addedAt: Date.now()
			};
			thread.sources.push(recorded);
			void saveThread(thread);
			return recorded;
		}
	};
}

async function saveThread(thread: SearchThread): Promise<void> {
	thread.updatedAt = Date.now();
	await db.searchThreads.save($state.snapshot(thread) as SearchThread);
}

function runnerFor(threadId: string): AgentRunner | null {
	const thread = threads.find((t) => t.id === threadId);
	if (!thread) return null;
	let runner = runners.get(threadId);
	if (!runner) {
		const recorder = recorderFor(threadId);
		runner = new AgentRunner({
			buildSystemPrompt: () => buildSearchPrompt(searchCapabilities()),
			buildTools: () => buildSearchTools(recorder),
			persist: (messages) => {
				const t = threads.find((x) => x.id === threadId);
				if (!t) return;
				t.messages = messages as unknown[];
				return saveThread(t);
			},
			initialMessages: thread.messages as AgentMessage[]
		});
		runners.set(threadId, runner);
	}
	return runner;
}

async function send(text: string): Promise<void> {
	const content = text.trim();
	if (!content) return;
	const thread = active ?? create();
	if (thread.title === 'New research') {
		thread.title = content.slice(0, 60);
		void saveThread(thread);
	}
	const runner = runnerFor(thread.id);
	await runner?.send(content);
}

async function remove(id: string): Promise<void> {
	// Drop the record from state FIRST: dispose triggers a final persist, and
	// persist looks the thread up by id — gone means it can't resurrect the
	// row we're about to delete.
	threads = threads.filter((t) => t.id !== id);
	if (activeId === id) activeId = null;
	runners.get(id)?.dispose();
	runners.delete(id);
	await db.searchThreads.delete(id);
}

export const searchThreads = {
	get ready() {
		return ready;
	},
	get threads() {
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
	get activeRunner() {
		return activeId ? runnerFor(activeId) : null;
	},
	init,
	reset,
	create,
	send,
	remove
};
