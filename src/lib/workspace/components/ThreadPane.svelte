<script lang="ts">
	// Chat pane placeholder — the pi agent chat (runner, tool cards, approval
	// gate) lands here in Phase 4.
	import { MessageSquare } from '@lucide/svelte';
	import { wsThreads } from '../stores/threads.svelte.js';

	interface Props {
		threadId: string;
	}

	let { threadId }: Props = $props();

	const thread = $derived(wsThreads.get(threadId));
</script>

<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
	<MessageSquare class="size-8 opacity-40" />
	<p class="text-sm font-medium">{thread?.title ?? 'Chat'}</p>
	<p class="text-xs">The synthesis agent arrives here soon.</p>
</div>
