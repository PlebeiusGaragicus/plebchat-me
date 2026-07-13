// Pure helpers turning pi AgentMessages into renderable pieces.

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { messageRole } from '$lib/ai/transcript.js';

export type RenderBlock =
	| { type: 'text'; text: string }
	| { type: 'toolCall'; id: string; name: string };

interface RawBlock {
	type: string;
	text?: string;
	id?: string;
	name?: string;
}

/** Assistant content blocks in order — text and toolCall interleaved. */
export function assistantBlocks(message: AgentMessage): RenderBlock[] {
	const content = (message as { content?: unknown }).content;
	if (!Array.isArray(content)) return [];
	const blocks: RenderBlock[] = [];
	for (const raw of content as RawBlock[]) {
		if (raw.type === 'text' && raw.text?.trim()) {
			blocks.push({ type: 'text', text: raw.text });
		} else if (raw.type === 'toolCall' && raw.id) {
			blocks.push({ type: 'toolCall', id: raw.id, name: raw.name ?? 'tool' });
		}
	}
	return blocks;
}

/** Text of a user message (pi accepts either a plain string or blocks). */
export function userText(message: AgentMessage): string {
	const content = (message as { content?: unknown }).content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return (content as RawBlock[])
		.filter((b) => b.type === 'text')
		.map((b) => b.text ?? '')
		.join('');
}

export function isDisplayable(message: AgentMessage): boolean {
	const role = messageRole(message);
	return role === 'user' || role === 'assistant';
}

export { messageRole };
