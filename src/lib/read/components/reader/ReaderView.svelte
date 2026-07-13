<script lang="ts">
	import { reader } from '$lib/read/stores/reader.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';
	import ChatPanel from '$lib/read/components/chat/ChatPanel.svelte';
	import AnnotationSidebar from './AnnotationSidebar.svelte';
	import EpubViewer from './EpubViewer.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import ReaderToolbar from './ReaderToolbar.svelte';
	import TocSidebar from './TocSidebar.svelte';
</script>

<div class="flex h-full flex-col">
	<ReaderToolbar />
	<ProgressBar />
	<div class="flex min-h-0 flex-1">
		{#if ui.tocOpen}
			<TocSidebar />
		{/if}
		<div class="min-w-0 flex-1">
			{#if reader.bookReady}
				<EpubViewer />
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
					Opening book…
				</div>
			{/if}
		</div>
		{#if ui.annotationsOpen}
			<AnnotationSidebar />
		{/if}
		{#if ui.chatOpen}
			<ChatPanel />
		{/if}
	</div>
</div>
