<script lang="ts">
	// Agent chat for one workspace thread: transcript with tool cards, the
	// patch_file approval banner, and the input bar. The runner (one per
	// thread) survives tab switches; concurrent threads keep streaming.
	import { CircleStop, Send, Settings2 } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/search/markdown.js';
	import { assistantBlocks, isDisplayable, messageRole, userText } from '$lib/ai/render.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	// Generic tool-run card (depends only on $lib/ai); lives with Search for now.
	import ToolCallCard from '$lib/search/components/ToolCallCard.svelte';
	import { searchUi } from '$lib/search/stores/ui.svelte.js';
	import { artifacts } from '../stores/artifacts.svelte.js';
	import { wsThreads } from '../stores/threads.svelte.js';

	let { threadId }: { threadId: string } = $props();

	const runner = $derived(wsThreads.runnerFor(threadId));

	let draft = $state('');
	let feedback = $state('');
	let scroller: HTMLElement | undefined = $state();

	// Keep the newest content in view while streaming.
	$effect(() => {
		void runner?.messages.length;
		void runner?.streamingMessage;
		void runner?.pendingApproval;
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	});

	async function send() {
		const text = draft.trim();
		if (!text || !runner || runner.isStreaming) return;
		draft = '';
		await runner.send(text);
	}

	function approvalSummary(args: unknown): { title: string; patches: { search: string; replace: string }[] } {
		const record = args as {
			file_id?: string;
			patches?: { search: string; replace: string }[];
			search?: string;
			replace?: string;
			description?: string;
		};
		const artifact = record.file_id ? artifacts.get(record.file_id) : undefined;
		const title = artifact
			? (artifact.versions[artifact.currentVersionIndex]?.title ?? 'untitled')
			: (record.file_id ?? 'unknown file');
		const patches =
			record.patches ??
			(record.search !== undefined && record.replace !== undefined
				? [{ search: record.search, replace: record.replace }]
				: []);
		return { title, patches };
	}
</script>

{#if !runner}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
		Chat not found
	</div>
{:else}
	<div class="flex h-full flex-col">
		{#if !settingsStore.isAiConfigured}
			<div class="border-b border-border bg-muted/40 px-4 py-3 text-sm">
				<p class="text-muted-foreground">
					No AI endpoint configured. The agent runs entirely in your browser — bring your own
					CORS-enabled endpoint and key.
				</p>
				<button
					onclick={() => (searchUi.settingsOpen = true)}
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
				>
					<Settings2 class="size-3.5" /> Configure AI endpoint
				</button>
			</div>
		{/if}

		<div bind:this={scroller} class="flex-1 overflow-y-auto px-4 py-3">
			{#each runner.messages.filter(isDisplayable) as message, i (i)}
				{#if messageRole(message) === 'user'}
					<div class="mb-3 text-right">
						<div
							data-testid="ws-message-user"
							class="inline-block max-w-[85%] rounded-xl bg-primary/10 px-3 py-2 text-left text-sm whitespace-pre-wrap"
						>
							{userText(message)}
						</div>
					</div>
				{:else}
					{#each assistantBlocks(message) as block, j (j)}
						{#if block.type === 'text'}
							<div
								data-testid="ws-message-assistant"
								class="md mb-3 max-w-[95%] rounded-xl bg-muted px-4 py-2.5 text-sm"
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized by renderMarkdown -->
								{@html renderMarkdown(block.text)}
							</div>
						{:else if runner.toolRuns[block.id]}
							<ToolCallCard run={runner.toolRuns[block.id]} />
						{/if}
					{/each}
				{/if}
			{/each}

			{#if runner.streamingMessage}
				{#each assistantBlocks(runner.streamingMessage) as block, i (i)}
					{#if block.type === 'text'}
						<div class="md mb-3 max-w-[95%] rounded-xl bg-muted px-4 py-2.5 text-sm">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized by renderMarkdown -->
							{@html renderMarkdown(block.text)}
						</div>
					{/if}
				{/each}
			{:else if runner.isStreaming && !runner.pendingApproval}
				<div class="mb-3 text-sm text-muted-foreground">Thinking…</div>
			{/if}

			{#if runner.error}
				<div
					data-testid="ws-error"
					class="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{runner.error}
				</div>
			{/if}
		</div>

		{#if runner.pendingApproval}
			{@const summary = approvalSummary(runner.pendingApproval.args)}
			<div
				data-testid="approval-banner"
				class="border-t border-primary/40 bg-primary/5 px-4 py-3 text-sm"
			>
				<p class="font-medium">
					The agent wants to edit <span class="text-primary">{summary.title}</span>
					({summary.patches.length}
					{summary.patches.length === 1 ? 'change' : 'changes'})
				</p>
				<div class="mt-2 max-h-48 space-y-2 overflow-y-auto">
					{#each summary.patches as patch, i (i)}
						<div class="rounded-lg border border-border text-xs">
							<pre
								class="overflow-x-auto bg-destructive/10 px-2 py-1 whitespace-pre-wrap text-destructive">{patch.search}</pre>
							<pre
								class="overflow-x-auto border-t border-border bg-emerald-500/10 px-2 py-1 whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">{patch.replace}</pre>
						</div>
					{/each}
				</div>
				<input
					type="text"
					bind:value={feedback}
					placeholder="Optional feedback if rejecting…"
					class="mt-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:border-ring focus:outline-none"
				/>
				<div class="mt-2 flex gap-2">
					<button
						data-testid="approve-patch"
						onclick={() => {
							runner.respond({ approved: true });
							feedback = '';
						}}
						class="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						Apply edit
					</button>
					<button
						data-testid="reject-patch"
						onclick={() => {
							runner.respond({ approved: false, feedback: feedback.trim() || undefined });
							feedback = '';
						}}
						class="rounded-lg border border-border px-4 py-1.5 text-xs transition-colors hover:bg-accent"
					>
						Reject
					</button>
				</div>
			</div>
		{/if}

		<div class="border-t border-border p-3">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={draft}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							void send();
						}
					}}
					placeholder="Ask the agent to read, write, or edit this project's files…"
					rows="2"
					data-testid="ws-chat-input"
					class="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
				></textarea>
				{#if runner.isStreaming}
					<button
						onclick={() => runner.stop()}
						aria-label="Stop"
						class="rounded-xl border border-border p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<CircleStop class="size-4" />
					</button>
				{:else}
					<button
						onclick={send}
						disabled={!draft.trim()}
						aria-label="Send"
						class="rounded-xl bg-primary p-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						<Send class="size-4" />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
