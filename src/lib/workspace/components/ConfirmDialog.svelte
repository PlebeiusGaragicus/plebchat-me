<script lang="ts">
	// Shared destructive-action confirm (the dashboard/sidebar delete modals).
	interface Props {
		title: string;
		body: string;
		confirmLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { title, body, confirmLabel = 'Delete', onConfirm, onCancel }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
	<div class="w-full max-w-sm rounded-xl border border-border bg-popover p-6 shadow-xl">
		<h3 class="text-lg font-semibold">{title}</h3>
		<p class="mt-2 text-sm text-muted-foreground">{body}</p>
		<div class="mt-6 flex gap-3">
			<button
				onclick={onCancel}
				class="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
			>
				Cancel
			</button>
			<button
				onclick={onConfirm}
				class="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>
