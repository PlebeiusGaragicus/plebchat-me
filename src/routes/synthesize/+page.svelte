<script lang="ts">
	// Synthesize mode: an IDE-like workspace — projects holding versioned
	// markdown artifacts, chats, and sources — built on the shared workspace
	// core ($lib/workspace, reused by Debate later). Deep links use query
	// params (?project=<id>) mirrored with replaceState, like Read's ?book=.
	// See docs/proposals/synthesize-mode.md.
	import '$lib/workspace/session.js';
	import { FlaskConical } from '@lucide/svelte';
	import { cyphertap } from 'cyphertap';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ProjectDashboard from '$lib/workspace/components/ProjectDashboard.svelte';
	import WorkspaceView from '$lib/workspace/components/WorkspaceView.svelte';
	import { projects } from '$lib/workspace/stores/projects.svelte.js';

	// Deep link in: ?project=<id> opens that project once the list has loaded.
	// $state so the mirror effect below stays quiet until this ran — otherwise
	// the mount-time mirror erases the param before it can be read.
	let handledInitialUrl = $state(false);
	$effect(() => {
		if (!projects.ready || handledInitialUrl) return;
		handledInitialUrl = true;
		const id = page.url.searchParams.get('project');
		if (id && projects.all.some((p) => p.id === id)) projects.activeId = id;
	});

	// Mirror the open project back into the URL.
	$effect(() => {
		if (!handledInitialUrl) return;
		const target = projects.activeId ? `?project=${projects.activeId}` : '';
		if (window.location.search !== target) {
			replaceState(`${resolve('/synthesize')}${target}`, {});
		}
	});
</script>

{#if !cyphertap.isLoggedIn}
	<div class="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
		<FlaskConical class="mb-4 size-12 text-muted-foreground/40" />
		<h1 class="text-2xl font-bold">Synthesize</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			An IDE-like workspace for turning sources into documents: versioned markdown files, AI
			chats that edit them with your approval, and your research sources side by side. Log in
			with the key button in the top bar to start.
		</p>
	</div>
{:else if projects.ready}
	{#if projects.active}
		<WorkspaceView project={projects.active} onBack={() => (projects.activeId = null)} />
	{:else}
		<ProjectDashboard
			heading="Synthesize Projects"
			subheading="Turn sources into documents: versioned files, AI chats, and research side by side."
			onSelect={(p) => (projects.activeId = p.id)}
		/>
	{/if}
{/if}
