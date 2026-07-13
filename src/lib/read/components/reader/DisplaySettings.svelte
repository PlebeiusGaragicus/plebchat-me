<script lang="ts">
	import type { ReadingSettings } from '$lib/stores/settings.svelte.js';
	import { reader } from '$lib/read/stores/reader.svelte.js';
	import { settingsStore } from '$lib/stores/settings.svelte.js';

	let { onclose }: { onclose: () => void } = $props();

	const THEMES: ReadingSettings['theme'][] = ['light', 'sepia', 'dark'];
	const FONTS = [
		{ label: 'Publisher', value: '' },
		{ label: 'Serif', value: 'Georgia, serif' },
		{ label: 'Sans', value: 'system-ui, sans-serif' }
	];

	function apply(patch: Partial<ReadingSettings>) {
		settingsStore.save({ reading: { ...settingsStore.settings.reading, ...patch } });
		reader.applyDisplaySettings(settingsStore.settings.reading);
	}
</script>

<div class="fixed inset-0 z-40" role="presentation" onmousedown={onclose}></div>

<div
	class="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-3 shadow-xl"
	role="dialog"
	aria-label="Display settings"
	data-testid="display-settings"
>
	<div class="mb-3">
		<span class="mb-1 block text-xs font-medium text-muted-foreground">Reading theme</span>
		<div class="flex gap-1.5">
			{#each THEMES as theme (theme)}
				<button
					data-testid="reading-theme-{theme}"
					class="flex-1 rounded-lg border py-1.5 text-xs capitalize {settingsStore.settings.reading
						.theme === theme
						? 'border-primary font-medium text-primary'
						: 'border-border'}"
					onclick={() => apply({ theme })}
				>
					{theme}
				</button>
			{/each}
		</div>
	</div>

	<div class="mb-3">
		<span class="mb-1 block text-xs font-medium text-muted-foreground">
			Font size — {settingsStore.settings.reading.fontSize}px
		</span>
		<input
			type="range"
			min="12"
			max="28"
			step="1"
			class="w-full accent-primary"
			value={settingsStore.settings.reading.fontSize}
			oninput={(e) => apply({ fontSize: Number(e.currentTarget.value) })}
		/>
	</div>

	<div class="mb-3">
		<span class="mb-1 block text-xs font-medium text-muted-foreground">
			Line height — {settingsStore.settings.reading.lineHeight}
		</span>
		<input
			type="range"
			min="1.2"
			max="2.2"
			step="0.1"
			class="w-full accent-primary"
			value={settingsStore.settings.reading.lineHeight}
			oninput={(e) => apply({ lineHeight: Number(e.currentTarget.value) })}
		/>
	</div>

	<div>
		<span class="mb-1 block text-xs font-medium text-muted-foreground">Font</span>
		<div class="flex gap-1.5">
			{#each FONTS as font (font.value)}
				<button
					class="flex-1 rounded-lg border py-1.5 text-xs {settingsStore.settings.reading
						.fontFamily === font.value
						? 'border-primary font-medium text-primary'
						: 'border-border'}"
					onclick={() => apply({ fontFamily: font.value })}
				>
					{font.label}
				</button>
			{/each}
		</div>
	</div>
</div>
