<script lang="ts">
	// SvelteReader ResearchInputBar shape: rounded card with an auto-growing
	// textarea over a controls row — effort selector (how aggressive the
	// search is), Web/Nostr tool toggles, settings gear, round submit.
	import { ArrowRight, Gauge, Globe, LoaderCircle, Settings, Square, Zap } from '@lucide/svelte';
	import { Popover } from 'bits-ui';
	import { settingsStore, type SearchEffort } from '$lib/stores/settings.svelte.js';
	import { searchUi } from '../stores/ui.svelte.js';

	interface Props {
		onSubmit: (query: string) => void;
		onStop?: () => void;
		isLoading?: boolean;
		placeholder?: string;
		autofocus?: boolean;
	}

	let {
		onSubmit,
		onStop,
		isLoading = false,
		placeholder = 'What would you like to research?',
		autofocus = false
	}: Props = $props();

	let query = $state('');
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let effortOpen = $state(false);

	const canSubmit = $derived(query.trim().length > 0 && !isLoading);
	const hasFirecrawlKey = $derived(Boolean(settingsStore.settings.search.firecrawlApiKey));
	const webActive = $derived(hasFirecrawlKey && searchUi.webEnabled);

	const EFFORTS: { key: SearchEffort; label: string; hint: string }[] = [
		{ key: 'quick', label: 'Quick', hint: '1–2 searches, fast answer' },
		{ key: 'balanced', label: 'Balanced', hint: 'Reads the best few pages' },
		{ key: 'thorough', label: 'Thorough', hint: 'Multiple angles, cross-checked' }
	];
	const effort = $derived(
		EFFORTS.find((e) => e.key === settingsStore.settings.search.effort) ?? EFFORTS[1]
	);

	function submit(e?: Event) {
		e?.preventDefault();
		if (!canSubmit) return;
		onSubmit(query.trim());
		query = '';
		if (textareaRef) textareaRef.style.height = 'auto';
	}

	function grow() {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 150)}px`;
		}
	}

	$effect(() => {
		if (autofocus && textareaRef && !isLoading) textareaRef.focus();
	});
</script>

<form onsubmit={submit} class="mx-auto w-full max-w-3xl">
	<div
		class="flex flex-col rounded-2xl border border-border bg-card shadow-lg shadow-black/5 transition-all focus-within:border-primary/50 dark:shadow-black/20"
	>
		<textarea
			bind:this={textareaRef}
			bind:value={query}
			data-testid="search-input"
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
					e.preventDefault();
					submit();
				}
			}}
			oninput={grow}
			{placeholder}
			rows={2}
			class="max-h-36 w-full resize-none bg-transparent px-4 pt-4 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
		></textarea>

		<div class="flex flex-wrap items-center gap-2 px-3 pt-2 pb-3">
			<!-- Effort selector -->
			<Popover.Root bind:open={effortOpen}>
				<Popover.Trigger
					data-testid="search-effort"
					class="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground"
				>
					<Gauge class="size-3.5" />
					{effort.label}
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content
						side="top"
						align="start"
						sideOffset={8}
						class="z-50 w-64 rounded-lg border border-border bg-popover p-1 shadow-lg"
					>
						{#each EFFORTS as option (option.key)}
							<button
								type="button"
								data-testid="search-effort-{option.key}"
								class="flex w-full flex-col rounded-md px-2.5 py-2 text-left hover:bg-accent {option.key ===
								effort.key
									? 'bg-primary/10'
									: ''}"
								onclick={() => {
									settingsStore.save({ search: { ...settingsStore.settings.search, effort: option.key } });
									effortOpen = false;
								}}
							>
								<span class="text-sm {option.key === effort.key ? 'text-primary' : ''}">
									{option.label}
								</span>
								<span class="text-xs text-muted-foreground">{option.hint}</span>
							</button>
						{/each}
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>

			<div class="h-5 w-px bg-border"></div>

			<!-- Web toggle -->
			<button
				type="button"
				onclick={() => (searchUi.webEnabled = !searchUi.webEnabled)}
				disabled={!hasFirecrawlKey}
				class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {webActive
					? 'border-primary/30 bg-primary/10 text-primary'
					: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}"
				title={hasFirecrawlKey
					? 'Search the web via Firecrawl'
					: 'Add a Firecrawl API key in settings to enable web search'}
			>
				<Globe class="size-3.5" />
				Web
			</button>

			<!-- Nostr toggle -->
			<button
				type="button"
				onclick={() => (searchUi.nostrEnabled = !searchUi.nostrEnabled)}
				class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors {searchUi.nostrEnabled
					? 'border-primary/30 bg-primary/10 text-primary'
					: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}"
				title="Search nostr via NIP-50"
			>
				<Zap class="size-3.5" />
				Nostr
			</button>

			<div class="flex-1"></div>

			<button
				type="button"
				data-testid="search-open-settings"
				class="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Search settings"
				onclick={() => (searchUi.settingsOpen = true)}
			>
				<Settings class="size-4" />
			</button>

			{#if isLoading && onStop}
				<button
					type="button"
					data-testid="search-stop"
					class="inline-flex items-center justify-center rounded-full bg-muted p-2.5 hover:bg-accent"
					title="Stop"
					onclick={onStop}
				>
					<Square class="size-5" />
				</button>
			{:else}
				<button
					type="submit"
					data-testid="search-send"
					disabled={!canSubmit}
					class="inline-flex items-center justify-center rounded-full bg-primary p-2.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
				>
					{#if isLoading}
						<LoaderCircle class="size-5 animate-spin" />
					{:else}
						<ArrowRight class="size-5" />
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
		<span>
			Press <kbd class="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd> to submit
		</span>
		<span>•</span>
		<span><kbd class="rounded bg-muted px-1 py-0.5 font-mono">Shift + Enter</kbd> for new line</span>
	</div>
</form>
