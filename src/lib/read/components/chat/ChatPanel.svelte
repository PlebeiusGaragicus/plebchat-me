<script lang="ts">
	import { ArrowLeft, Highlighter, MessageSquarePlus, Send, Square, Trash2 } from '@lucide/svelte';
	import { chat } from '$lib/read/stores/chat.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';

	let draft = $state('');
	let scroller: HTMLElement | undefined = $state();

	// Keep the newest message in view while streaming.
	$effect(() => {
		void chat.streamingText;
		void chat.active?.messages.length;
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	});

	function submit() {
		const text = draft;
		draft = '';
		void chat.send(text);
	}
</script>

<aside
	class="flex w-80 shrink-0 flex-col border-l border-border"
	aria-label="Chat"
	data-testid="chat-panel"
>
	{#if !settingsStore.isAiConfigured}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p class="text-sm text-muted-foreground">
				No AI endpoint configured. Bring your own — a local LM Studio / Ollama, OpenRouter, or any
				OpenAI-compatible server that allows browser requests.
			</p>
			<button
				class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				onclick={() => (ui.settingsOpen = true)}
			>
				Open Settings
			</button>
		</div>
	{:else if !chat.active}
		<div class="flex items-center justify-between border-b border-border p-2.5">
			<h3 class="text-sm font-semibold text-muted-foreground">Chats</h3>
			<button
				data-testid="chat-new"
				class="flex items-center gap-1 rounded p-1.5 text-sm text-primary hover:bg-accent"
				title="New chat about this book"
				onclick={() => chat.startGeneral()}
			>
				<MessageSquarePlus class="size-4" /> New
			</button>
		</div>
		<div class="flex-1 overflow-y-auto p-2">
			{#if chat.threads.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					Select text in the book and choose “Chat about this”, or start a general chat.
				</p>
			{:else}
				{#each chat.threads as thread (thread.id)}
					<div class="group flex items-start gap-1">
						<button
							data-testid="chat-thread"
							class="min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-accent"
							onclick={() => (chat.activeId = thread.id)}
						>
							<div class="flex items-center gap-1.5 text-sm">
								{#if thread.annotationId}
									<span data-testid="thread-annotation-link" class="shrink-0 text-primary">
										<Highlighter class="size-3" />
									</span>
								{/if}
								<span class="truncate">{thread.title}</span>
							</div>
							{#if thread.context}
								<div class="truncate text-xs text-primary/80">
									“{thread.context.quote.slice(0, 50)}”
								</div>
							{/if}
							<div class="text-xs text-muted-foreground">{thread.messages.length} messages</div>
						</button>
						<button
							class="mt-2 hidden rounded p-1 text-muted-foreground group-hover:block hover:text-destructive"
							title="Delete chat"
							onclick={() => void chat.removeThread(thread.id)}
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="flex items-center gap-2 border-b border-border p-2.5">
			<button
				class="rounded p-1 hover:bg-accent"
				title="All chats"
				onclick={() => (chat.activeId = null)}
			>
				<ArrowLeft class="size-4" />
			</button>
			<div class="min-w-0 flex-1 truncate text-sm font-medium">{chat.active.title}</div>
		</div>
		{#if chat.active.context}
			<div class="border-b border-border bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
				“{chat.active.context.quote.slice(0, 200)}”
			</div>
		{/if}
		<div bind:this={scroller} class="flex-1 overflow-y-auto p-3">
			{#each chat.active.messages as message, i (i)}
				<div class="mb-3 {message.role === 'user' ? 'text-right' : ''}">
					<div
						data-testid="chat-message-{message.role}"
						class="inline-block max-w-[90%] rounded-xl px-3 py-2 text-left text-sm whitespace-pre-wrap {message.role ===
						'user'
							? 'bg-primary/10'
							: 'bg-muted'}"
					>
						{message.content}
					</div>
				</div>
			{/each}
			{#if chat.busy}
				<div class="mb-3">
					<div
						class="inline-block max-w-[90%] rounded-xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
					>
						{chat.streamingText || '…'}
					</div>
				</div>
			{/if}
		</div>
		<div class="flex items-end gap-2 border-t border-border p-2.5">
			<textarea
				data-testid="chat-input"
				class="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm focus:outline-none"
				rows="1"
				placeholder="Ask about the book…"
				bind:value={draft}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
			></textarea>
			{#if chat.busy}
				<button
					class="rounded-lg bg-muted p-2 hover:bg-accent"
					title="Stop"
					onclick={() => chat.stop()}
				>
					<Square class="size-4" />
				</button>
			{:else}
				<button
					data-testid="chat-send"
					class="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
					title="Send"
					disabled={!draft.trim()}
					onclick={submit}
				>
					<Send class="size-4" />
				</button>
			{/if}
		</div>
	{/if}
</aside>
