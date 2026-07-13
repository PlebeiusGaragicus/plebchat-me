<script lang="ts">
	// Source detail popup (SvelteReader SourceModal shape). We persist source
	// metadata, not page bodies — so this shows the recorded details plus
	// open/copy actions; full-content preview can come with news-reading mode.
	import { Check, Copy, ExternalLink, Globe, X, Zap } from '@lucide/svelte';
	import { searchUi } from '../stores/ui.svelte.js';

	let copied = $state(false);

	const source = $derived(searchUi.modalSource);

	function close() {
		searchUi.modalSource = null;
	}

	function copyUrl() {
		if (!source) return;
		void navigator.clipboard.writeText(source.url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function domain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && source) close();
	}}
/>

{#if source}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
		role="presentation"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div
			class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
			role="dialog"
			aria-label="Source details"
			data-testid="source-modal"
		>
			<div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
				<div class="flex min-w-0 items-start gap-3">
					<span class="mt-0.5 shrink-0 font-mono text-sm font-semibold text-primary">
						[{source.id}]
					</span>
					<div class="min-w-0">
						<h2 class="text-sm font-semibold">{source.title}</h2>
						<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
							{#if source.kind === 'nostr'}
								<Zap class="size-3 shrink-0" /> nostr event
							{:else}
								<Globe class="size-3 shrink-0" />
								{domain(source.url)}
							{/if}
						</p>
					</div>
				</div>
				<button
					class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					title="Close"
					onclick={close}
				>
					<X class="size-4" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto px-4 py-3">
				{#if source.description}
					<p class="mb-3 text-sm whitespace-pre-wrap">{source.description}</p>
				{/if}
				<dl class="space-y-1.5 text-xs">
					<div class="flex gap-2">
						<dt class="w-16 shrink-0 text-muted-foreground">Type</dt>
						<dd>{source.kind === 'nostr' ? 'Nostr event (NIP-50 search)' : 'Web page'}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-16 shrink-0 text-muted-foreground">Status</dt>
						<dd>
							{source.fetched ? 'Read in full by the agent' : 'Surfaced by search (snippet only)'}
						</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-16 shrink-0 text-muted-foreground">Added</dt>
						<dd>{new Date(source.addedAt).toLocaleString()}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-16 shrink-0 text-muted-foreground">
							{source.kind === 'nostr' ? 'Event' : 'URL'}
						</dt>
						<dd class="break-all text-muted-foreground">{source.url}</dd>
					</div>
				</dl>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
				<button
					class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
					onclick={copyUrl}
				>
					{#if copied}
						<Check class="size-3.5 text-primary" /> Copied
					{:else}
						<Copy class="size-3.5" /> Copy
					{/if}
				</button>
				{#if source.kind === 'web'}
					<a
						href={source.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
					>
						<ExternalLink class="size-3.5" /> Open
					</a>
				{/if}
			</div>
		</div>
	</div>
{/if}
