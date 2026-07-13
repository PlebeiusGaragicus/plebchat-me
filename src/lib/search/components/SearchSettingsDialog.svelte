<script lang="ts">
	import { X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { settingsStore, type AiApiFlavor } from '$lib/stores/settings.svelte.js';
	import { searchUi } from '../stores/ui.svelte.js';

	// Local draft so typing doesn't half-apply; saved on submit.
	let aiDraft = $state({ ...settingsStore.settings.ai });
	let searchDraft = $state({ ...settingsStore.settings.search });

	function save() {
		settingsStore.save({
			ai: { ...aiDraft },
			search: {
				firecrawlApiKey: searchDraft.firecrawlApiKey.trim(),
				searchRelay: searchDraft.searchRelay.trim() || 'wss://relay.nostr.band'
			}
		});
		toast.success('Settings saved');
		searchUi.settingsOpen = false;
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
	role="presentation"
	onmousedown={(e) => {
		if (e.target === e.currentTarget) searchUi.settingsOpen = false;
	}}
>
	<div
		class="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-xl"
		role="dialog"
		aria-label="Search settings"
		data-testid="search-settings"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Search settings</h2>
			<button
				class="rounded p-1 hover:bg-accent"
				title="Close"
				onclick={() => (searchUi.settingsOpen = false)}
			>
				<X class="size-4" />
			</button>
		</div>

		<h3 class="mb-1 text-sm font-medium">AI endpoint</h3>
		<p class="mb-3 text-xs text-muted-foreground">
			The research agent runs in your browser against any endpoint that allows CORS requests —
			LM Studio or Ollama on localhost, OpenRouter, Anthropic, or your own gateway. Config and
			keys stay in this browser; they are never synced.
		</p>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Base URL</span>
			<input
				data-testid="search-ai-base-url"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="http://localhost:1234/v1"
				bind:value={aiDraft.baseUrl}
			/>
		</label>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Model</span>
			<input
				data-testid="search-ai-model"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="e.g. qwen2.5-14b-instruct"
				bind:value={aiDraft.model}
			/>
		</label>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">API key (optional)</span>
			<input
				type="password"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="sk-…"
				bind:value={aiDraft.apiKey}
			/>
		</label>
		<label class="mb-4 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Wire protocol</span>
			<select
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				bind:value={() => aiDraft.api, (v: AiApiFlavor) => (aiDraft.api = v)}
			>
				<option value="openai-completions">OpenAI-compatible (/chat/completions)</option>
				<option value="anthropic-messages">Anthropic-compatible (/v1/messages)</option>
			</select>
		</label>

		<h3 class="mb-1 text-sm font-medium">Web search</h3>
		<p class="mb-3 text-xs text-muted-foreground">
			Web search and page fetching use <a
				class="text-primary underline underline-offset-2"
				href="https://firecrawl.dev"
				target="_blank"
				rel="noopener noreferrer">Firecrawl</a
			> with your own key. Without a key the agent can still search nostr.
		</p>
		<label class="mb-4 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Firecrawl API key</span>
			<input
				data-testid="firecrawl-key"
				type="password"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="fc-…"
				bind:value={searchDraft.firecrawlApiKey}
			/>
		</label>

		<h3 class="mb-1 text-sm font-medium">Nostr search</h3>
		<label class="mb-4 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">
				NIP-50 search relay
			</span>
			<input
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs focus:outline-none"
				placeholder="wss://relay.nostr.band"
				bind:value={searchDraft.searchRelay}
			/>
		</label>

		<button
			data-testid="search-settings-save"
			class="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			onclick={save}
		>
			Save
		</button>
	</div>
</div>
