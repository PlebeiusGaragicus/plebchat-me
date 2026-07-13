// Transcript helpers: heal transcripts persisted mid-run and extract
// displayable text. Ported from socratic-seminar's agent/persistence.ts.

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';

interface ContentBlock {
	type: string;
	text?: string;
	id?: string;
	name?: string;
}

function blocks(message: AgentMessage): ContentBlock[] {
	const content = (message as { content?: unknown }).content;
	return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

export function messageRole(message: AgentMessage): string | undefined {
	return (message as { role?: string }).role;
}

/** Concatenated text blocks of an assistant message (empty for others). */
export function assistantText(message: AgentMessage): string {
	if (messageRole(message) !== 'assistant') return '';
	return blocks(message)
		.filter((b) => b.type === 'text')
		.map((b) => b.text ?? '')
		.join('');
}

/**
 * pi requires every assistant toolCall to have a matching toolResult. A
 * transcript saved mid-run (tab closed during a tool) violates that — append
 * synthetic error results for orphaned calls before rehydrating.
 */
export function sanitizeTranscript(messages: AgentMessage[]): AgentMessage[] {
	const answered = new Set<string>();
	for (const message of messages) {
		if (messageRole(message) === 'toolResult') {
			const id = (message as unknown as ToolResultMessage).toolCallId;
			if (id) answered.add(id);
		}
	}

	const healed: AgentMessage[] = [];
	for (const message of messages) {
		healed.push(message);
		if (messageRole(message) !== 'assistant') continue;
		for (const block of blocks(message)) {
			if (block.type !== 'toolCall' || !block.id || answered.has(block.id)) continue;
			const synthetic: ToolResultMessage = {
				role: 'toolResult',
				toolCallId: block.id,
				toolName: block.name ?? 'unknown',
				content: [
					{
						type: 'text',
						text: 'Interrupted — the session ended before this tool completed. Re-issue the call if still needed.'
					}
				],
				isError: true,
				timestamp: Date.now()
			};
			healed.push(synthetic as AgentMessage);
		}
	}
	return healed;
}

export type { AssistantMessage };
