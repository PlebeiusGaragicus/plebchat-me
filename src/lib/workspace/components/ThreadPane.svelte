<script lang="ts">
	// Chat pane for one workspace thread — thin wrapper so TabbedPanel stays
	// agnostic of the agent machinery.
	import ChatPanel from './ChatPanel.svelte';

	interface Props {
		threadId: string;
	}

	let { threadId }: Props = $props();
</script>

<ChatPanel {threadId} />
