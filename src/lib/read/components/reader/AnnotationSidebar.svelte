<script lang="ts">
	import { Eye, EyeOff, Globe, Loader2, MessageSquare, StickyNote, Users } from '@lucide/svelte';
	import { HIGHLIGHT_COLORS, display } from '$lib/read/epub/service.js';
	import { annotations } from '$lib/read/stores/annotations.svelte.js';
	import { chat } from '$lib/read/stores/chat.svelte.js';
	import { foreignAnnotations } from '$lib/read/stores/foreignAnnotations.svelte.js';
	import { reader } from '$lib/read/stores/reader.svelte.js';
	import { selection } from '$lib/read/stores/selection.svelte.js';

	let sharingId = $state<string | null>(null);
	let exportHighlight = $state(false);
</script>

<aside
	class="w-72 shrink-0 overflow-y-auto border-l border-border p-3"
	aria-label="Annotations"
	data-testid="annotation-sidebar"
>
	<h3 class="mb-2 text-sm font-semibold text-muted-foreground">
		Annotations ({annotations.all.length})
	</h3>

	{#if annotations.all.length === 0}
		<p class="py-8 text-center text-sm text-muted-foreground">
			Select text in the book to highlight it or attach a note.
		</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each annotations.all as anno (anno.id)}
				<div
					class="group rounded-lg border border-border p-2.5 transition-all hover:border-muted-foreground/40 hover:shadow-md"
					data-testid="annotation-card"
				>
					<!-- Only the quote itself jumps/opens — blank card space stays inert. -->
					<button
						class="max-w-full rounded text-left hover:bg-accent/50"
						onclick={() => {
							void annotations.goTo(anno.id).then(() => selection.edit(anno.id, null));
						}}
					>
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
								<p class="line-clamp-3 text-sm">“{anno.quote}”</p>
								{#if anno.note}
									<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{anno.note}</p>
								{/if}
							</div>
						</div>
					</button>

					{#if sharingId === anno.id}
						<div class="mt-2 rounded-lg bg-muted p-2 text-xs">
							<p class="mb-1.5">
								Publish this annotation <strong>in plaintext</strong> to your relays? It stays
								editable, and you can make it private again later.
							</p>
							<label class="mb-2 flex items-center gap-1.5">
								<input type="checkbox" class="accent-primary" bind:checked={exportHighlight} />
								Also publish as a NIP-84 highlight (Highlighter-compatible, immutable)
							</label>
							<div class="flex gap-2">
								<button
									data-testid="annotation-share-confirm"
									class="rounded bg-primary px-2 py-1 font-medium text-primary-foreground hover:bg-primary/90"
									onclick={() => {
										void annotations.setShared(anno.id, true, exportHighlight);
										sharingId = null;
									}}
								>
									Publish
								</button>
								<button class="rounded bg-accent px-2 py-1" onclick={() => (sharingId = null)}>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<div class="mt-1 flex items-center justify-end gap-1">
							<button
								data-testid="annotation-discuss"
								class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {chat.threadCountFor(
									anno.id
								) > 0
									? 'text-primary'
									: 'hidden text-muted-foreground group-hover:flex hover:text-foreground'}"
								title={chat.threadCountFor(anno.id) > 0
									? 'Open the conversation about this highlight'
									: 'Chat about this highlight'}
								onclick={() => chat.openForAnnotation(anno)}
							>
								<MessageSquare class="size-3" />
								{chat.threadCountFor(anno.id) || ''}
							</button>
							{#if !reader.book?.localOnly}
								<!-- Sync never pushes a local-only book's annotations — no share. -->
								<button
									data-testid="annotation-share-toggle"
									class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {anno.shared
										? 'text-emerald-500'
										: 'hidden text-muted-foreground group-hover:flex hover:text-foreground'}"
									title={anno.shared ? 'Public — click to make private' : 'Share publicly'}
									onclick={() => {
										if (anno.shared) void annotations.setShared(anno.id, false);
										else {
											exportHighlight = false;
											sharingId = anno.id;
										}
									}}
								>
									<Globe class="size-3" />
									{anno.shared ? 'Public' : 'Share'}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Multi-perspective reading: other people's shared highlights on this
	     exact file (same sha256 ⇒ same CFIs). Explicit fetch, read-only. -->
	<div class="mt-6 border-t border-border pt-4">
		<h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
			<Users class="size-4" /> Other readers
		</h3>
		{#if !foreignAnnotations.loaded}
			<button
				data-testid="load-foreign-highlights"
				class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
				disabled={foreignAnnotations.loading}
				onclick={() => {
					if (reader.book) void foreignAnnotations.fetchForBook(reader.book.sha256);
				}}
			>
				{#if foreignAnnotations.loading}
					<Loader2 class="size-3.5 animate-spin" />
				{:else}
					<Users class="size-3.5" />
				{/if}
				Load readers' highlights
			</button>
		{:else if foreignAnnotations.readers.length === 0}
			<p class="py-2 text-center text-xs text-muted-foreground">
				No one else has shared highlights on this book (on your relays).
			</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each foreignAnnotations.readers as fr (fr.hex)}
					<div class="rounded-lg border border-border p-2" data-testid="foreign-reader">
						<div class="flex items-center gap-2">
							<span class="min-w-0 flex-1 truncate text-xs font-medium">
								{fr.name ?? `${fr.hex.slice(0, 8)}…`}
							</span>
							<span class="shrink-0 text-xs text-muted-foreground">{fr.annotations.length}</span>
							<button
								data-testid="foreign-reader-toggle"
								class="shrink-0 rounded p-1 {fr.shown
									? 'text-sky-500'
									: 'text-muted-foreground hover:text-foreground'}"
								title={fr.shown ? 'Hide highlights' : 'Show highlights'}
								onclick={() => foreignAnnotations.toggle(fr.hex)}
							>
								{#if fr.shown}
									<Eye class="size-3.5" />
								{:else}
									<EyeOff class="size-3.5" />
								{/if}
							</button>
						</div>
						{#if fr.shown}
							<div class="mt-2 flex flex-col gap-1.5">
								{#each fr.annotations as anno (anno.id)}
									<button
										class="w-full rounded p-1 text-left hover:bg-accent"
										onclick={() => void display(anno.cfiRange)}
									>
										<p class="line-clamp-2 text-xs text-muted-foreground">
											“{anno.quote}”
										</p>
										{#if anno.note}
											<p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground italic">
												{anno.note}
											</p>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>
