// BYO-endpoint Model for the pi agent runtime. pi-ai dispatches transport on
// `api` + `baseUrl`, so any OpenAI-completions- or Anthropic-messages-
// compatible server that allows browser (CORS) requests works — no provider
// SDK involved. Ported from socratic-seminar's agent/model.ts.

import type { Model } from '@earendil-works/pi-ai';
import type { AiSettings } from '$lib/stores/settings.svelte.js';

export type AgentModel = Model<'openai-completions' | 'anthropic-messages'>;

export function buildModel(settings: AiSettings): AgentModel {
	return {
		id: settings.model,
		name: settings.model,
		api: settings.api,
		provider: 'custom',
		baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
		reasoning: false,
		input: ['text'],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 8192
	} as AgentModel;
}
