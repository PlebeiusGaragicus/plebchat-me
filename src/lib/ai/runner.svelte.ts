// Mode-agnostic pi agent runner: one AgentRunner wraps one pi Agent and
// mirrors its (non-reactive) state into Svelte $state for the UI. Ported
// from socratic-seminar's agent/runner.svelte.ts, with the app-specific
// pieces (approval gates, thread meta, store singletons) lifted out into
// the RunnerConfig so each mode supplies its own.
//
// Model, system prompt, and tools are rebuilt at the top of every send() —
// settings changes and tool gates (e.g. a Firecrawl key added mid-thread)
// apply per run, and the prompt never advertises a tool the run lacks.

import { Agent, type AgentMessage, type AgentTool } from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { settingsStore } from '$lib/stores/settings.svelte.js';
import { buildModel } from './model.js';
import { pruneContext } from './pruning.js';
import { sanitizeTranscript } from './transcript.js';

export interface ToolRun {
	toolCallId: string;
	name: string;
	args: unknown;
	status: 'running' | 'done' | 'error';
	/** Text summary of the result, for the tool-call card. */
	resultText?: string;
}

export interface PendingApproval {
	toolName: string;
	args: unknown;
	resolve: (decision: ApprovalDecision) => void;
	reject: (reason?: unknown) => void;
}

export interface ApprovalDecision {
	approved: boolean;
	feedback?: string;
}

export interface RunnerConfig {
	/** Composed fresh per run — gate sections on the tools actually present. */
	buildSystemPrompt: () => string;
	/** Built fresh per run; receives the runner so tools can reach its state. */
	buildTools: (runner: AgentRunner) => AgentTool<never>[];
	/** Called with the full transcript after each message and at run end. */
	persist?: (messages: AgentMessage[]) => void | Promise<void>;
	/** Transcript to rehydrate (sanitized here — orphaned toolCalls healed). */
	initialMessages?: AgentMessage[];
	/** Async transcript loader — send() waits for it once (device-local
	 * transcripts stored separately from thread metadata). */
	loadInitialMessages?: () => Promise<AgentMessage[]>;
	/** Tool names gated behind user approval (pendingApproval + respond()). */
	approvalRequired?: Set<string>;
	/** UI hook fired when approval is requested (e.g. reveal the target file). */
	onApprovalRequest?: (toolName: string, args: unknown) => void;
}

export class AgentRunner {
	messages = $state<AgentMessage[]>([]);
	streamingMessage = $state<AssistantMessage | null>(null);
	isStreaming = $state(false);
	error = $state<string | null>(null);
	toolRuns = $state<Record<string, ToolRun>>({});
	pendingApproval = $state<PendingApproval | null>(null);

	private agent: Agent;
	private config: RunnerConfig;
	private hydration: Promise<void> | null = null;

	constructor(config: RunnerConfig) {
		this.config = config;
		this.agent = new Agent({
			getApiKey: () => settingsStore.settings.ai.apiKey || undefined,
			transformContext: async (messages) => pruneContext(messages),
			beforeToolCall: async (context, signal) => {
				if (!config.approvalRequired?.has(context.toolCall.name)) return undefined;
				return this.requestApproval(context.toolCall.name, context.args, signal);
			}
		});
		if (config.initialMessages?.length) {
			this.agent.state.messages = sanitizeTranscript(config.initialMessages);
			this.syncMessages();
			this.rebuildToolRuns();
		} else if (config.loadInitialMessages) {
			this.hydration = config.loadInitialMessages().then((stored) => {
				if (stored.length && this.agent.state.messages.length === 0) {
					this.agent.state.messages = sanitizeTranscript(stored);
					this.syncMessages();
					this.rebuildToolRuns();
				}
			});
		}
		this.agent.subscribe((event) => {
			switch (event.type) {
				case 'agent_start':
					this.isStreaming = true;
					this.error = null;
					break;
				case 'message_update':
					// The whole partial assistant message is re-emitted per delta.
					if ((event.message as { role?: string }).role === 'assistant') {
						this.streamingMessage = event.message as AssistantMessage;
					}
					break;
				case 'message_end':
					this.streamingMessage = null;
					this.syncMessages();
					void this.persist();
					break;
				case 'agent_end':
					this.isStreaming = false;
					this.streamingMessage = null;
					if (this.agent.state.errorMessage) this.error = this.agent.state.errorMessage;
					this.syncMessages();
					void this.persist();
					break;
				case 'tool_execution_start':
					this.toolRuns[event.toolCallId] = {
						toolCallId: event.toolCallId,
						name: event.toolName,
						args: event.args,
						status: 'running'
					};
					break;
				case 'tool_execution_end': {
					const run = this.toolRuns[event.toolCallId];
					if (run) {
						run.status = event.isError ? 'error' : 'done';
						run.resultText = summarizeResult(event.result);
					}
					break;
				}
			}
		});
	}

	get status(): 'idle' | 'busy' | 'awaiting-input' | 'error' {
		if (this.pendingApproval) return 'awaiting-input';
		if (this.isStreaming) return 'busy';
		if (this.error) return 'error';
		return 'idle';
	}

	/** Gate a tool call behind user approval. Returning {block, reason} makes
	 * pi emit an error tool result, so rejection feedback reaches the model. */
	private async requestApproval(
		toolName: string,
		args: unknown,
		signal?: AbortSignal
	): Promise<{ block: true; reason: string } | undefined> {
		this.config.onApprovalRequest?.(toolName, args);
		let decision: ApprovalDecision;
		try {
			decision = await new Promise<ApprovalDecision>((resolve, reject) => {
				const abortHandler = () => {
					this.pendingApproval = null;
					reject(new Error('Run stopped while awaiting approval.'));
				};
				if (signal?.aborted) return abortHandler();
				signal?.addEventListener('abort', abortHandler, { once: true });
				this.pendingApproval = {
					toolName,
					args,
					resolve: (value) => {
						signal?.removeEventListener('abort', abortHandler);
						resolve(value);
					},
					reject: (reason) => {
						signal?.removeEventListener('abort', abortHandler);
						reject(reason);
					}
				};
			});
		} catch {
			return { block: true, reason: 'The run was stopped before the user decided.' };
		}
		if (decision.approved) return undefined;
		return {
			block: true,
			reason: decision.feedback
				? `User rejected this edit with feedback: ${decision.feedback}`
				: 'User rejected this edit.'
		};
	}

	/** Resolve the pending approval (from the chat panel's banner). */
	respond(decision: ApprovalDecision): void {
		const pending = this.pendingApproval;
		if (!pending) return;
		this.pendingApproval = null;
		pending.resolve(decision);
	}

	async send(text: string): Promise<void> {
		if (this.hydration) await this.hydration;
		if (this.isStreaming) return;
		this.error = null;
		this.agent.state.model = buildModel(settingsStore.settings.ai);
		this.agent.state.systemPrompt = this.config.buildSystemPrompt();
		this.agent.state.tools = this.config.buildTools(this);
		try {
			await this.agent.prompt(text);
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
			this.isStreaming = false;
		}
	}

	stop(): void {
		if (this.pendingApproval) {
			const pending = this.pendingApproval;
			this.pendingApproval = null;
			pending.reject(new Error('Stopped by user'));
		}
		this.agent.abort();
	}

	dispose(): void {
		this.stop();
		void this.persist();
	}

	get transcript(): AgentMessage[] {
		return this.agent.state.messages;
	}

	private syncMessages(): void {
		this.messages = [...this.agent.state.messages];
	}

	/** toolRuns is runtime state — rebuild it from a rehydrated transcript so
	 * historical tool calls still render as cards. */
	private rebuildToolRuns(): void {
		const runs: Record<string, ToolRun> = {};
		for (const message of this.agent.state.messages) {
			const record = message as {
				role?: string;
				content?: { type: string; id?: string; name?: string; arguments?: unknown }[];
				toolCallId?: string;
				isError?: boolean;
			};
			if (record.role === 'assistant' && Array.isArray(record.content)) {
				for (const block of record.content) {
					if (block.type === 'toolCall' && block.id) {
						runs[block.id] = {
							toolCallId: block.id,
							name: block.name ?? 'tool',
							args: block.arguments,
							status: 'done'
						};
					}
				}
			} else if (record.role === 'toolResult' && record.toolCallId) {
				const run = runs[record.toolCallId];
				if (run) {
					run.status = record.isError ? 'error' : 'done';
					run.resultText = summarizeResult(message);
				}
			}
		}
		this.toolRuns = runs;
	}

	private async persist(): Promise<void> {
		try {
			await this.config.persist?.(this.agent.state.messages);
		} catch {
			// Persistence failures must not kill the run.
		}
	}
}

function summarizeResult(result: unknown): string {
	const content = (result as { content?: { type: string; text?: string }[] })?.content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((b) => b.type === 'text')
		.map((b) => b.text ?? '')
		.join('')
		.slice(0, 500);
}
