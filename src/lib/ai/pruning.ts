// Context pruning for long agent threads, wired as the Agent's
// transformContext. Ported from socratic-seminar's agent/pruning.ts.
// Contract: never throws, returns the input untouched on any error.

import type { AgentMessage } from '@earendil-works/pi-agent-core';

const CONTEXT_WINDOW = 128_000;
const HEADROOM = 16_000;
const BUDGET = CONTEXT_WINDOW - HEADROOM;

function estimateTokens(messages: AgentMessage[]): number {
	try {
		return JSON.stringify(messages).length / 4;
	} catch {
		return 0;
	}
}

function role(message: AgentMessage): string | undefined {
	return (message as { role?: string }).role;
}

export function pruneContext(messages: AgentMessage[]): AgentMessage[] {
	try {
		if (messages.length < 4 || estimateTokens(messages) <= BUDGET) return messages;

		const firstUser = messages.findIndex((m) => role(m) === 'user');
		if (firstUser === -1) return messages;

		// Keep everything up to and including the first user message; drop the
		// oldest of the rest until we fit — never letting the surviving tail
		// start on a toolResult whose toolCall was dropped.
		const head = messages.slice(0, firstUser + 1);
		let tail = messages.slice(firstUser + 1);
		while (tail.length > 1 && estimateTokens([...head, ...tail]) > BUDGET) {
			tail = tail.slice(1);
			while (tail.length > 0 && role(tail[0]) === 'toolResult') {
				tail = tail.slice(1);
			}
		}

		const notice = {
			role: 'user',
			content: '[Earlier conversation truncated to fit the context window.]',
			timestamp: Date.now()
		} as AgentMessage;
		return [...head, notice, ...tail];
	} catch {
		return messages;
	}
}
