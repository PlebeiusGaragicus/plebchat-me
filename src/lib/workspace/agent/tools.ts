// Workspace agent tools (socratic-seminar's files.ts + sources.ts, retargeted
// at the workspace stores). Tool descriptions are the model-visible contract.
// Reads see live (unsaved) editor content; patch_file is approval-gated by
// the runner (see buildWorkspaceTools' approvalRequired export).
// Tools THROW on failure — the message reaches the model as an error result.

import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { Artifact } from '$lib/db/types.js';
import { jsonResult, withArgRepair } from '$lib/ai/tools.js';
import { artifacts } from '../stores/artifacts.svelte.js';
import { sources } from '../stores/sources.svelte.js';
import { workspace } from '../stores/workspace.svelte.js';

/** Tools the runner must gate behind user approval. */
export const APPROVAL_REQUIRED = new Set(['patch_file']);

const ERRORS = {
	fileNotFound: (id: string) =>
		`File '${id}' not found. Call list_files() to see the current files and ids.`,
	sourceNotFound: (id: string) =>
		`Source '${id}' not found. Call list_sources() to see the current sources and ids.`,
	patchNotFound: (n: number) =>
		`Patch ${n}: search text not found. read_file() again and copy the exact current text (including whitespace).`,
	patchAmbiguous: (n: number, count: number) =>
		`Patch ${n}: search text matches ${count} times — it must match exactly once. Include more surrounding context.`
};

function titleOf(artifact: Artifact): string {
	return artifact.versions[artifact.currentVersionIndex]?.title ?? 'untitled';
}

/** Live content if the file is open in an editor, else stored current version. */
function contentOf(artifact: Artifact): string {
	return artifacts.getLiveContent(artifact.id) ?? '';
}

function globToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
}

const listFilesSchema = Type.Object({});
const readFileSchema = Type.Object({
	file_id: Type.String({ description: 'Unique identifier from list_files()' })
});
const grepFilesSchema = Type.Object({
	pattern: Type.String({ description: 'Text to search for' }),
	glob_pattern: Type.Optional(Type.String({ description: 'Optional filename filter' })),
	case_sensitive: Type.Optional(Type.Boolean({ description: 'Default false' }))
});
const globFilesSchema = Type.Object({
	pattern: Type.String({ description: 'Glob pattern to match against file titles' })
});
const writeFileSchema = Type.Object({
	title: Type.String({ description: 'File name/title' }),
	content: Type.String({ description: 'Markdown content' })
});
const patchFileSchema = Type.Object({
	file_id: Type.String({ description: 'File ID from list_files()' }),
	patches: Type.Optional(
		Type.Array(
			Type.Object({
				search: Type.String({
					description: 'Exact text to find (must match exactly once, including whitespace)'
				}),
				replace: Type.String({ description: 'Replacement text' })
			}),
			{ description: "List of {'search': '...', 'replace': '...'} objects" }
		)
	),
	description: Type.Optional(Type.String({ description: 'What changed (optional but helpful)' })),
	// Legacy single-patch form some models fall back to.
	search: Type.Optional(Type.String()),
	replace: Type.Optional(Type.String())
});
const listSourcesSchema = Type.Object({});
const readSourceSchema = Type.Object({
	source_id: Type.String({ description: 'Unique identifier from list_sources()' })
});

export function buildWorkspaceTools(): AgentTool<never>[] {
	const listFiles: AgentTool<typeof listFilesSchema> = {
		name: 'list_files',
		label: 'List files',
		description:
			'List all files in the current project.\n\nReturns JSON array of file metadata with id and title.\nUse this first to discover what files are available.',
		parameters: listFilesSchema,
		async execute() {
			const files = artifacts.all;
			if (files.length === 0) return jsonResult('No files found in project.');
			return jsonResult(files.map((a) => ({ id: a.id, title: titleOf(a) })));
		}
	};

	const readFile: AgentTool<typeof readFileSchema> = {
		name: 'read_file',
		label: 'Read file',
		description:
			"Read the full content of a file by its ID.\n\nArgs:\n    file_id: Unique identifier from list_files()\n\nReturns the file's content or an error if not found.",
		parameters: readFileSchema,
		async execute(_id, params) {
			const artifact = artifacts.get(params.file_id);
			if (!artifact) throw new Error(ERRORS.fileNotFound(params.file_id));
			return jsonResult({
				id: artifact.id,
				title: titleOf(artifact),
				content: contentOf(artifact),
				version: artifact.currentVersionIndex + 1,
				totalVersions: artifact.versions.length
			});
		}
	};

	const grepFiles: AgentTool<typeof grepFilesSchema> = {
		name: 'grep_files',
		label: 'Grep files',
		description:
			'Search for a text pattern across all project files.\n\nArgs:\n    pattern: Text to search for\n    glob_pattern: Optional filename filter (e.g., "*.md")\n    case_sensitive: Case-sensitive search (default: False)\n\nReturns matches with file_id, title, line_number, and excerpt.',
		parameters: grepFilesSchema,
		async execute(_id, params) {
			const needle = params.case_sensitive ? params.pattern : params.pattern.toLowerCase();
			const globRe = params.glob_pattern ? globToRegex(params.glob_pattern) : null;
			const matches: {
				file_id: string;
				file_title: string;
				line_number: number;
				excerpt: string;
			}[] = [];
			let truncated = false;
			for (const artifact of artifacts.all) {
				const title = titleOf(artifact);
				if (globRe && !globRe.test(title)) continue;
				const lines = contentOf(artifact).split('\n');
				let perFile = 0;
				for (const [i, line] of lines.entries()) {
					const haystack = params.case_sensitive ? line : line.toLowerCase();
					if (!haystack.includes(needle)) continue;
					if (perFile >= 5 || matches.length >= 50) {
						truncated = true;
						break;
					}
					const excerpt = [lines[i - 1], line, lines[i + 1]]
						.filter((l) => l !== undefined)
						.join('\n')
						.slice(0, 300);
					matches.push({ file_id: artifact.id, file_title: title, line_number: i + 1, excerpt });
					perFile++;
				}
			}
			return jsonResult({ matches, truncated });
		}
	};

	const globFiles: AgentTool<typeof globFilesSchema> = {
		name: 'glob_files',
		label: 'Glob files',
		description:
			'Find files matching a glob pattern.\n\nArgs:\n    pattern: Glob pattern (e.g., "*.md", "draft-*")\n\nReturns array of matching files with id and title.',
		parameters: globFilesSchema,
		async execute(_id, params) {
			const re = globToRegex(params.pattern);
			return jsonResult(
				artifacts.all.filter((a) => re.test(titleOf(a))).map((a) => ({ id: a.id, title: titleOf(a) }))
			);
		}
	};

	const writeFile: AgentTool<typeof writeFileSchema> = {
		name: 'write_file',
		label: 'Create file',
		description:
			'Create a new markdown file.\n\nArgs:\n    title: File name/title\n    content: Markdown content\n\nReturns success message with new file ID.',
		parameters: writeFileSchema,
		executionMode: 'sequential',
		async execute(_id, params) {
			const artifact = await artifacts.create(params.title, params.content);
			if (!artifact) throw new Error('No project is open.');
			workspace.openItem(artifact.id, 'artifact', 'left');
			return jsonResult({ success: true, file_id: artifact.id });
		}
	};

	const patchFile: AgentTool<typeof patchFileSchema> = {
		name: 'patch_file',
		label: 'Edit file',
		description:
			"Patch a file with one or more string replacements.\n\nArgs:\n    file_id: File ID from list_files()\n    patches: List of {'search': '...', 'replace': '...'} objects\n    description: What changed (optional but helpful)\n\nEach search string must match EXACTLY ONCE (including whitespace). Batch related\nedits into one call to avoid multiple approval prompts.\n\nReturns success message or error if search text not found.",
		parameters: patchFileSchema,
		executionMode: 'sequential',
		async execute(_id, params) {
			const patches =
				params.patches ??
				(params.search !== undefined && params.replace !== undefined
					? [{ search: params.search, replace: params.replace }]
					: []);
			if (patches.length === 0) {
				throw new Error("No patches provided. Pass patches: [{'search': ..., 'replace': ...}].");
			}
			const artifact = artifacts.get(params.file_id);
			if (!artifact) throw new Error(ERRORS.fileNotFound(params.file_id));

			// Patch against the very latest content: flush any dirty editor
			// state first, then read live.
			await artifacts.flush(params.file_id);
			let content = artifacts.getLiveContent(params.file_id) ?? '';

			for (const [i, patch] of patches.entries()) {
				const occurrences = content.split(patch.search).length - 1;
				if (occurrences === 0) throw new Error(ERRORS.patchNotFound(i + 1));
				if (occurrences > 1) throw new Error(ERRORS.patchAmbiguous(i + 1, occurrences));
				content = content.replace(patch.search, patch.replace);
			}

			// Live-content update: an open editor refreshes reactively; the flush
			// persists in place — no version bump (versions are explicit
			// user snapshots).
			artifacts.updateLiveContent(params.file_id, content);
			await artifacts.flush(params.file_id);
			return jsonResult({ success: true, patches_applied: patches.length });
		}
	};

	const listSources: AgentTool<typeof listSourcesSchema> = {
		name: 'list_sources',
		label: 'List sources',
		description:
			'List the saved reference sources in the current project.\n\nReturns JSON array with id, title, and url. Cite sources by title in prose.',
		parameters: listSourcesSchema,
		async execute() {
			if (sources.all.length === 0) return jsonResult('No sources in project.');
			return jsonResult(sources.all.map((s) => ({ id: s.id, title: s.title, url: s.url })));
		}
	};

	const readSource: AgentTool<typeof readSourceSchema> = {
		name: 'read_source',
		label: 'Read source',
		description:
			"Read the full markdown content of a saved source.\n\nArgs:\n    source_id: Unique identifier from list_sources()\n\nReturns the source's content.",
		parameters: readSourceSchema,
		async execute(_id, params) {
			const source = sources.get(params.source_id);
			if (!source) throw new Error(ERRORS.sourceNotFound(params.source_id));
			return jsonResult({ id: source.id, title: source.title, url: source.url, content: source.content });
		}
	};

	return [
		listFiles,
		readFile,
		grepFiles,
		globFiles,
		writeFile,
		patchFile,
		listSources,
		readSource
	].map((t) => withArgRepair(t as unknown as AgentTool<never>));
}
