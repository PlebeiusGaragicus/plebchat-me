<script lang="ts">
	// "Explore Recent Events" (SvelteReader DiscoveryFeed shape): recent nostr
	// long-form articles with topic filter pills. Selecting an article becomes
	// news-reading mode later — for now cards are preview-only.
	import { Globe, LoaderCircle, RefreshCw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DISCOVER_TOPICS, discover } from '../stores/discover.svelte.js';

	$effect(() => {
		discover.ensureLoaded();
	});

	function articleDate(unixSeconds: number): string {
		return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="w-full" data-testid="discover-feed">
	<div
		class="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex items-center gap-3">
			<Globe class="size-10 text-primary" />
			<h2 class="text-3xl font-light">Explore Recent Events</h2>
		</div>
		<div class="flex flex-row items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
			{#each DISCOVER_TOPICS as topic (topic.key)}
				{@const isActive = discover.activeTopic === topic.key}
				<button
					class="rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-all {isActive
						? 'border-primary/40 bg-primary/10 text-primary'
						: 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
					onclick={() => discover.setTopic(isActive ? undefined : topic.key)}
				>
					{topic.display}
				</button>
			{/each}
			<button
				class="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Refresh"
				onclick={() => void discover.reload()}
			>
				<RefreshCw class="size-3.5" />
			</button>
		</div>
	</div>

	{#if discover.error}
		<div class="flex flex-col items-center py-12 text-center">
			<p class="mb-4 text-sm text-muted-foreground">
				Couldn't load recent articles from the search relay.
			</p>
			<button
				class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				onclick={() => void discover.reload()}
			>
				Try again
			</button>
		</div>
	{:else if discover.articles.length === 0 && !discover.loading}
		<div class="flex flex-col items-center py-16 text-center">
			<Globe class="mb-4 size-16 text-muted-foreground/40" />
			<p class="text-muted-foreground">No recent articles found for this topic</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each discover.articles as article (article.id)}
				<button
					class="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg"
					onclick={() => toast.info('News reading mode is coming soon')}
				>
					{#if article.image}
						<div class="h-32 w-full overflow-hidden bg-muted">
							<img
								src={article.image}
								alt=""
								loading="lazy"
								class="h-full w-full object-cover transition-transform group-hover:scale-105"
								onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
							/>
						</div>
					{/if}
					<div class="flex flex-1 flex-col p-4">
						<h3 class="mb-1 line-clamp-2 font-medium">{article.title}</h3>
						{#if article.summary}
							<p class="line-clamp-3 flex-1 text-xs text-muted-foreground">{article.summary}</p>
						{/if}
						<div class="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
							<span>{articleDate(article.publishedAt)}</span>
							<span>·</span>
							<span class="font-mono">{article.pubkey.slice(0, 8)}…</span>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}

	{#if discover.loading}
		<div class="flex items-center justify-center py-8">
			<LoaderCircle class="size-8 animate-spin text-muted-foreground" />
		</div>
	{/if}
</div>
