// Book import: hash → dedup → metadata/cover extraction → one-transaction
// write. The file's sha256 IS the book's identity (see docs/nostr-event-model.md)
// — renderer-independent, format-independent. foliate-js reads EPUB, MOBI/KF8
// (.mobi/.azw/.azw3), FB2, and CBZ.

import { makeBook } from './vendor/foliate/view.js';
import { db } from '$lib/db/index.js';
import type { Book } from '$lib/db/types.js';
import { sha256Hex } from '$lib/utils.js';

export const SUPPORTED_EXTENSIONS = /\.(epub|mobi|azw3?|fb2|fbz|cbz)$/i;
export const IMPORT_ACCEPT = '.epub,.mobi,.azw,.azw3,.fb2,.fbz,.cbz,application/epub+zip';

export class DuplicateBookError extends Error {
	constructor(public existing: Book) {
		super(`Already in library: ${existing.title}`);
	}
}

interface FoliateBook {
	metadata?: Record<string, unknown>;
	getCover?(): Promise<Blob | null>;
	destroy?(): void;
}

/** foliate metadata values are strings or language maps; take a string. */
function asString(value: unknown): string | undefined {
	if (typeof value === 'string') return value || undefined;
	if (value && typeof value === 'object') {
		const first = Object.values(value as Record<string, unknown>)[0];
		if (typeof first === 'string') return first || undefined;
	}
	return undefined;
}

/** Contributors are arrays of strings or `{ name }` objects. */
function contributorsToString(value: unknown): string | undefined {
	const list = Array.isArray(value) ? value : value ? [value] : [];
	const names = list
		.map((c) => asString(typeof c === 'object' && c !== null && 'name' in c ? (c as { name: unknown }).name : c))
		.filter(Boolean);
	return names.length ? names.join(', ') : undefined;
}

/** Pull a bare ISBN out of an identifier like "urn:isbn:978…". */
function extractIsbn(identifier: string | undefined): string | undefined {
	const match = identifier?.replace(/-/g, '').match(/isbn:?(\d{10,13})/i) ?? null;
	return match?.[1];
}

/** Pull the cover image out of book bytes (throwaway foliate instance) —
 * used at import, and again after a Blossom restore, where the bytes are the
 * only cover source we can rely on. */
export async function extractCover(
	buffer: ArrayBuffer
): Promise<{ blob: Blob; mimeType: string } | undefined> {
	let parsed: FoliateBook | undefined;
	try {
		parsed = (await makeBook(new File([buffer], 'book.epub'))) as FoliateBook;
		const blob = await parsed.getCover?.();
		if (!blob) return undefined;
		return { blob, mimeType: blob.type || 'image/jpeg' };
	} catch {
		return undefined; // No cover is fine.
	} finally {
		parsed?.destroy?.();
	}
}

export async function importEpubFile(file: File): Promise<Book> {
	const buffer = await file.arrayBuffer();
	const sha256 = await sha256Hex(buffer);

	const existing = await db.books.get(sha256);
	if (existing) throw new DuplicateBookError(existing);

	// Throwaway instance just for metadata + cover; the reader opens its own.
	let parsed: FoliateBook | undefined;
	try {
		parsed = (await makeBook(file)) as FoliateBook;
		const m = parsed.metadata ?? {};
		const cover = await parsed.getCover?.().catch(() => null);

		const language = Array.isArray(m.language) ? asString(m.language[0]) : asString(m.language);
		const now = Date.now();
		const book: Book = {
			sha256,
			title: asString(m.title) || file.name.replace(SUPPORTED_EXTENSIONS, ''),
			creator: contributorsToString(m.author) || 'Unknown',
			publisher: contributorsToString(m.publisher),
			language,
			isbn: extractIsbn(asString(m.identifier)),
			description: asString(m.description),
			fileSize: file.size,
			addedAt: now,
			updatedAt: now
		};

		await db.books.import(
			book,
			{ sha256, blob: new Blob([buffer], { type: file.type || 'application/octet-stream' }) },
			cover ? { sha256, blob: cover, mimeType: cover.type || 'image/jpeg' } : undefined
		);
		return book;
	} finally {
		parsed?.destroy?.();
	}
}
