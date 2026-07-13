<script lang="ts">
	import { X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';

	// Local draft so typing doesn't half-apply; saved on submit.
	let draft = $state({ ...settingsStore.settings.ai });
	let relaysDraft = $state(settingsStore.settings.relays.join('\n'));
	let blossomDraft = $state(settingsStore.settings.blossomServers.join('\n'));

	function parseList(text: string, prefix: RegExp): string[] {
		return text
			.split('\n')
			.map((line) => line.trim().replace(/\/$/, ''))
			.filter((line) => prefix.test(line));
	}

	function save() {
		settingsStore.save({
			ai: { ...draft },
			relays: parseList(relaysDraft, /^wss?:\/\//),
			blossomServers: parseList(blossomDraft, /^https?:\/\//)
		});
		toast.success('Settings saved');
		ui.settingsOpen = false;
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
	role="presentation"
	onmousedown={(e) => {
		if (e.target === e.currentTarget) ui.settingsOpen = false;
	}}
>
	<div
		class="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-xl"
		role="dialog"
		aria-label="Settings"
		data-testid="read-settings"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Settings</h2>
			<button
				class="rounded p-1 hover:bg-accent"
				title="Close"
				onclick={() => (ui.settingsOpen = false)}
			>
				<X class="size-4" />
			</button>
		</div>

		<h3 class="mb-1 text-sm font-medium">AI endpoint</h3>
		<p class="mb-3 text-xs text-muted-foreground">
			Any OpenAI-compatible server that allows browser (CORS) requests: LM Studio or Ollama on
			localhost, OpenRouter, Anthropic, or your own gateway. Config and keys stay in this browser —
			they are never synced.
		</p>

		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Base URL</span>
			<input
				data-testid="ai-base-url"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="http://localhost:1234/v1"
				bind:value={draft.baseUrl}
			/>
		</label>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Model</span>
			<input
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="e.g. qwen2.5-14b-instruct"
				bind:value={draft.model}
			/>
		</label>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">API key (optional)</span>
			<input
				type="password"
				class="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				placeholder="sk-…"
				bind:value={draft.apiKey}
			/>
		</label>
		<label class="mb-4 flex items-center gap-2 text-sm">
			<input type="checkbox" class="accent-primary" bind:checked={draft.streaming} />
			Stream responses
		</label>

		<h3 class="mb-1 text-sm font-medium">Sync</h3>
		<p class="mb-3 text-xs text-muted-foreground">
			Relays hold your (encrypted) library state; Blossom servers hold backed-up book files.
			Nothing is published without an explicit Sync / Back up / Share action.
		</p>
		<label class="mb-2 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">Relays (one per line)</span>
			<textarea
				class="w-full resize-none rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs focus:outline-none"
				rows="2"
				bind:value={relaysDraft}
			></textarea>
		</label>
		<label class="mb-4 block">
			<span class="mb-1 block text-xs font-medium text-muted-foreground">
				Blossom servers (one per line)
			</span>
			<textarea
				class="w-full resize-none rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-mono text-xs focus:outline-none"
				rows="2"
				bind:value={blossomDraft}
			></textarea>
		</label>

		<button
			data-testid="settings-save"
			class="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			onclick={save}
		>
			Save
		</button>
	</div>
</div>
