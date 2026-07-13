// Shared helpers for defining pi AgentTools. Ported from socratic-seminar's
// tools/shared.ts. Tools THROW on failure — the thrown message reaches the
// model as an error tool result; never encode errors in content.

import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';

/** Wrap a payload as the standard text tool result the model reads. */
export function jsonResult<T>(payload: unknown, details?: T): AgentToolResult<T> {
	return {
		content: [
			{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }
		],
		details: details as T
	};
}

/**
 * Some models emit tool arguments as a JSON *string* (occasionally with a
 * stray trailing `)` from function-call syntax bleeding through). Repair
 * before schema validation instead of failing the call.
 */
export function withArgRepair<T extends AgentTool<never>>(tool: T): T {
	return {
		...tool,
		prepareArguments(args: unknown) {
			let repaired = args;
			if (typeof args === 'string') {
				let text = args.trim();
				if (text.endsWith('),')) text = text.slice(0, -2).trim();
				else if (text.endsWith(')')) text = text.slice(0, -1).trim();
				try {
					repaired = JSON.parse(text);
				} catch {
					throw new Error(
						`Invalid arguments for tool '${tool.name}': expected a JSON object. Retry with a proper JSON object.`
					);
				}
			}
			return (tool.prepareArguments ? tool.prepareArguments(repaired) : repaired) as never;
		}
	};
}
