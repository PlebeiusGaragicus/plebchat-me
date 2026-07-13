// Chat threads of the open project. The verbatim pi transcript lives in a
// separate TranscriptRecord (loaded lazily by the runner); this list is
// metadata only. One AgentRunner per thread, kept across tab switches so
// concurrent runs keep streaming.

import { nanoid } from 'nanoid';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { AgentRunner } from '$lib/ai/runner.svelte.js';
import { db } from '$lib/db/index.js';
import type { WorkspaceThread } from '$lib/db/types.js';
import { messageRole } from '$lib/ai/transcript.js';
import { buildWorkspacePrompt } from '../agent/prompt.js';
import { APPROVAL_REQUIRED, buildWorkspaceTools } from '../agent/tools.js';
import { artifacts } from './artifacts.svelte.js';
import { sources } from './sources.svelte.js';
import { workspace } from './workspace.svelte.js';
import { projects } from './projects.svelte.js';

let list = $state<WorkspaceThread[]>([]);
let projectId: string | null = null;

// Runners hold their own $state; the map itself needs no reactivity —
// runnerFor lazily fills it and may be called from a $derived (no $state
// writes here).
const runners = new Map<string, AgentRunner>();

const sorted = $derived([...list].sort((a, b) => b.updatedAt - a.updatedAt));

async function load(id: string): Promise<void> {
	projectId = id;
	list = await db.workspaceThreads.getByProject(id);
}

function reset(): void {
	for (const runner of runners.values()) runner.dispose();
	runners.clear();
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
	// Drop the record from state FIRST: dispose triggers a final persist, and
	// persist looks the thread up by id — gone means it can't resurrect the
	// transcript we're about to delete.
	list = list.filter((t) => t.id !== id);
	runners.get(id)?.dispose();
	runners.delete(id);
	await db.workspaceThreads.delete(id); // cascades to the transcript
}

/** Title new threads from the first message; keep a preview line fresh. */
function updateThreadMeta(thread: WorkspaceThread, messages: AgentMessage[]): void {
	const firstUser = messages.find((m) => messageRole(m) === 'user');
	if (thread.title === 'New Chat' && firstUser) {
		const content = (firstUser as { content?: unknown }).content;
		const text = (
			typeof content === 'string'
				? content
				: Array.isArray(content)
					? content
							.filter((b) => (b as { type?: string }).type === 'text')
							.map((b) => (b as { text?: string }).text ?? '')
							.join('')
					: ''
		).trim();
		if (text) thread.title = text.length > 40 ? `${text.slice(0, 40)}…` : text;
	}
	const lastAssistant = [...messages].reverse().find((m) => messageRole(m) === 'assistant');
	const blocks = (lastAssistant as { content?: { type: string; text?: string }[] })?.content;
	if (Array.isArray(blocks)) {
		const text = blocks
			.filter((b) => b.type === 'text')
			.map((b) => b.text ?? '')
			.join('')
			.trim();
		if (text) thread.description = text.length > 80 ? `${text.slice(0, 80)}…` : text;
	}
}

function runnerFor(threadId: string): AgentRunner | null {
	const thread = list.find((t) => t.id === threadId);
	if (!thread) return null;
	let runner = runners.get(threadId);
	if (!runner) {
		const ownerProjectId = thread.projectId;
		runner = new AgentRunner({
			buildSystemPrompt: () =>
				buildWorkspacePrompt({
					projectTitle: projects.active?.title ?? 'Untitled project',
					artifacts: artifacts.all,
					sources: sources.all
				}),
			buildTools: () => buildWorkspaceTools(),
			approvalRequired: APPROVAL_REQUIRED,
			// Reveal the file about to change so the user can judge the patch.
			onApprovalRequest: (_tool, args) => {
				const fileId = (args as { file_id?: string }).file_id;
				if (fileId) workspace.openItem(fileId, 'artifact', 'left');
			},
			loadInitialMessages: async () =>
				((await db.transcripts.get(threadId))?.messages ?? []) as AgentMessage[],
			persist: (messages) => {
				const t = list.find((x) => x.id === threadId);
				if (t) {
					updateThreadMeta(t, messages);
					void save(t);
				}
				return db.transcripts.save({
					threadId,
					projectId: ownerProjectId,
					messages: messages as unknown[],
					updatedAt: Date.now()
				});
			}
		});
		runners.set(threadId, runner);
	}
	return runner;
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
	remove,
	runnerFor
};
