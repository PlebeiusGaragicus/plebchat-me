<script lang="ts">
	// Read-only window into other users' public shelves: shared 30101 books +
	// shared 30104 annotations. See docs/nostr-event-model.md.
	import {
		ArrowLeft,
		BookOpen,
		CloudDownload,
		Globe,
		Loader2,
		Search,
		StickyNote,
		Users
	} from '@lucide/svelte';
	import { HIGHLIGHT_COLORS } from '$lib/read/epub/service.js';
	import { browse } from '$lib/read/stores/browse.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';

	let npubInput = $state('');
	let expandedSha = $state<string | null>(null);

	function back(): void {
		if (browse.mode !== 'start') browse.mode = 'start';
		else ui.view = 'library';
	}

	function displayName(p: { hex: string; name?: string }): string {
		return p.name ?? browse.shortNpub(p.hex);
	}
</script>

<div class="flex h-full flex-col" data-testid="browse-view">
	<div class="flex items-center gap-2 border-b border-border px-3 py-1.5">
		<button class="rounded p-1.5 hover:bg-accent" title="Back" onclick={back}>
			<ArrowLeft class="size-4" />
		</button>
		<div class="min-w-0 flex-1 text-center">
			<span class="truncate text-sm font-medium">
				{#if browse.mode === 'shelf' && browse.target}
					{displayName(browse.target)}'s shelf
				{:else if browse.mode === 'readers' && browse.readersBook}
					Readers of “{browse.readersBook.title}”
				{:else}
					Browse libraries
				{/if}
			</span>
		</div>
		<span class="w-6"></span>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl p-6">
			{#if browse.loading}
				<div class="flex justify-center py-16">
					<Loader2 class="size-6 animate-spin text-muted-foreground" />
				</div>
			{:else if browse.mode === 'start'}
				<p class="mb-3 text-sm text-muted-foreground">
					See what someone has chosen to share: their public shelf and public annotations.
					Browsing is read-only and publishes nothing.
				</p>
				<form
					class="mb-6 flex gap-2"
					onsubmit={(e) => {
						e.preventDefault();
						if (npubInput.trim()) void browse.browseUser(npubInput);
					}}
				>
					<input
						data-testid="browse-npub-input"
						class="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 font-mono text-sm focus:outline-none"
						placeholder="npub1…"
						bind:value={npubInput}
					/>
					<button
						data-testid="browse-go"
						class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						disabled={!npubInput.trim()}
						type="submit"
					>
						<Search class="size-4" /> Browse
					</button>
				</form>

				<h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
					<Users class="size-4" /> Your follows
				</h3>
				{#if browse.follows === null}
					<div class="flex justify-center py-8">
						<Loader2 class="size-5 animate-spin text-muted-foreground" />
					</div>
				{:else if browse.follows.length === 0}
					<p class="py-6 text-center text-sm text-muted-foreground">
						No follows found on your relays — paste an npub above instead.
					</p>
				{:else}
					<div class="flex flex-col gap-1">
						{#each browse.follows as follow (follow.hex)}
							<button
								class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
								onclick={() => void browse.browseUser(follow.hex)}
							>
								{#if follow.picture}
									<img
										src={follow.picture}
										alt=""
										class="size-7 shrink-0 rounded-full object-cover"
									/>
								{:else}
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
									>
										{displayName(follow).slice(0, 1).toUpperCase()}
									</span>
								{/if}
								<span class="min-w-0 truncate text-sm">{displayName(follow)}</span>
								<span class="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
									{browse.shortNpub(follow.hex)}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			{:else if browse.mode === 'shelf'}
				{#if browse.shelf.length === 0 && Object.keys(browse.looseAnnotations).length === 0}
					<div class="flex flex-col items-center gap-3 py-16 text-center">
						<BookOpen class="size-10 text-muted-foreground/40" />
						<p class="max-w-sm text-sm text-muted-foreground">
							Nothing shared (or nothing reached your relays). Their library is private by
							default — only books and annotations they explicitly share show up here.
						</p>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each browse.shelf as fb (fb.sha256)}
							<div class="rounded-lg border border-border p-3" data-testid="foreign-book">
								<div class="flex gap-3">
									{#if fb.coverUrl}
										<img
											src={fb.coverUrl}
											alt=""
											class="h-24 w-16 shrink-0 rounded object-cover shadow-sm"
										/>
									{:else}
										<div
											class="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-muted"
										>
											<BookOpen class="size-5 text-muted-foreground/50" />
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="text-sm font-medium">{fb.book.title}</div>
										<div class="text-xs text-muted-foreground">{fb.book.creator}</div>
										<div
											class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
										>
											{#if fb.inLibrary}
												<span class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-500">
													In your library
												</span>
											{/if}
											{#if fb.annotations.length}
												<button
													class="underline-offset-2 hover:underline"
													onclick={() =>
														(expandedSha = expandedSha === fb.sha256 ? null : fb.sha256)}
												>
													{fb.annotations.length} public annotation{fb.annotations.length > 1
														? 's'
														: ''}
												</button>
											{/if}
										</div>
										{#if !fb.inLibrary && fb.book.blossom?.servers.length}
											<button
												data-testid="download-foreign-book"
												class="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
												disabled={browse.isDownloading(fb.sha256)}
												onclick={() => void browse.downloadBook(fb)}
											>
												{#if browse.isDownloading(fb.sha256)}
													<Loader2 class="size-3.5 animate-spin" />
												{:else}
													<CloudDownload class="size-3.5" />
												{/if}
												Add to my library
											</button>
										{/if}
									</div>
								</div>
								{#if expandedSha === fb.sha256}
									<div class="mt-3 flex flex-col gap-2 border-t border-border pt-3">
										{#each fb.annotations as anno (anno.id)}
											<div class="flex items-start gap-2">
												{#if anno.color}
													<span
														class="mt-1 size-3 shrink-0 rounded-full"
														style="background: {HIGHLIGHT_COLORS[anno.color]}"
													></span>
												{:else}
													<StickyNote class="mt-0.5 size-3.5 shrink-0 text-destructive" />
												{/if}
												<div class="min-w-0">
													<p class="text-sm">“{anno.quote}”</p>
													{#if anno.note}
														<p class="mt-0.5 text-xs text-muted-foreground">{anno.note}</p>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}

						{#each Object.entries(browse.looseAnnotations) as [sha, annos] (sha)}
							<div class="rounded-lg border border-dashed border-border p-3">
								<div class="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
									<Globe class="size-3.5" />
									Public annotations on an unshared book ({sha.slice(0, 8)}…)
								</div>
								<div class="flex flex-col gap-2">
									{#each annos as anno (anno.id)}
										<div class="flex items-start gap-2">
											{#if anno.color}
												<span
													class="mt-1 size-3 shrink-0 rounded-full"
													style="background: {HIGHLIGHT_COLORS[anno.color]}"
												></span>
											{:else}
												<StickyNote class="mt-0.5 size-3.5 shrink-0 text-destructive" />
											{/if}
											<div class="min-w-0">
												<p class="text-sm">“{anno.quote}”</p>
												{#if anno.note}
													<p class="mt-0.5 text-xs text-muted-foreground">{anno.note}</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else if browse.mode === 'readers'}
				{#if browse.readers.length === 0}
					<p class="py-16 text-center text-sm text-muted-foreground">
						No one else has shared annotations on this book (on your relays).
					</p>
				{:else}
					<div class="flex flex-col gap-1">
						{#each browse.readers as reader (reader.profile.hex)}
							<button
								class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
								onclick={() => void browse.browseUser(reader.profile.hex)}
							>
								{#if reader.profile.picture}
									<img
										src={reader.profile.picture}
										alt=""
										class="size-7 shrink-0 rounded-full object-cover"
									/>
								{:else}
									<span
										class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
									>
										{displayName(reader.profile).slice(0, 1).toUpperCase()}
									</span>
								{/if}
								<span class="min-w-0 truncate text-sm">{displayName(reader.profile)}</span>
								<span class="ml-auto shrink-0 text-xs text-muted-foreground">
									{reader.count} annotation{reader.count > 1 ? 's' : ''}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
