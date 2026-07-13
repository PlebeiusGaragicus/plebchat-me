// One-time migration from the superseded VibeReader app. Both apps deploy on
// the plebchat.me origin, so its per-npub database (`vibereader::<npub>`) is
// reachable from here. Relay sync repopulates metadata for users who synced,
// but book-file Blobs never ride the relays — and users who NEVER synced have
// their whole library only in that local DB. So this copies every store,
// skipping records that already exist here (local plebchat data wins).
//
// Offered via a toast (explicit user action, per the philosophy); "Not now"
// re-offers next login, "copy" or a completed run sets a kv flag.

import { toast } from 'svelte-sonner';
import { db } from '$lib/db/index.js';
import { library } from './stores/library.svelte.js';
import { sync } from './stores/sync.svelte.js';

const MIGRATED_KEY = 'vibereader-migration-done';
const OLD_STORES = [
	'books',
	'bookFiles',
	'covers',
	'locations',
	'progress',
	'annotations',
	'chats',
	'tombstones'
] as const;

function openRaw(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		// No version → opens at the existing version, never upgrades.
		const req = indexedDB.open(name);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function getAllRaw(dbi: IDBDatabase, store: string): Promise<{ key: IDBValidKey; value: unknown }[]> {
	return new Promise((resolve, reject) => {
		if (!dbi.objectStoreNames.contains(store)) return resolve([]);
		const out: { key: IDBValidKey; value: unknown }[] = [];
		const req = dbi.transaction(store, 'readonly').objectStore(store).openCursor();
		req.onsuccess = () => {
			const cursor = req.result;
			if (!cursor) return resolve(out);
			out.push({ key: cursor.primaryKey, value: cursor.value });
			void cursor.continue();
		};
		req.onerror = () => reject(req.error);
	});
}

async function copyLibrary(npub: string): Promise<number> {
	const old = await openRaw(`vibereader::${npub}`);
	let copied = 0;
	try {
		for (const store of OLD_STORES) {
			for (const { value } of await getAllRaw(old, store)) {
				const record = value as never;
				// Skip records plebchat already has — local data wins.
				switch (store) {
					case 'books': {
						const r = record as { sha256: string };
						if (!(await db.books.get(r.sha256))) {
							await db.books.save(record);
							copied++;
						}
						break;
					}
					case 'bookFiles': {
						const r = record as { sha256: string };
						if (!(await db.bookFiles.get(r.sha256))) {
							await db.bookFiles.save(record); // raw put — Blob
							copied++;
						}
						break;
					}
					case 'covers': {
						const r = record as { sha256: string };
						if (!(await db.covers.get(r.sha256))) {
							await db.covers.save(record); // raw put — Blob
							copied++;
						}
						break;
					}
					case 'locations': {
						const r = record as { sha256: string };
						if (!(await db.locations.get(r.sha256))) {
							await db.locations.save(record);
							copied++;
						}
						break;
					}
					case 'progress': {
						const r = record as { sha256: string };
						if (!(await db.progress.get(r.sha256))) {
							await db.progress.save(record);
							copied++;
						}
						break;
					}
					case 'annotations': {
						const r = record as { id: string };
						if (!(await db.annotations.getAll()).some((a) => a.id === r.id)) {
							await db.annotations.save(record);
							copied++;
						}
						break;
					}
					case 'chats': {
						await db.chats.save(record);
						copied++;
						break;
					}
					case 'tombstones': {
						const r = record as { kind: number; d: string };
						if (!(await db.tombstones.get(r.kind, r.d))) {
							await db.tombstones.save(record);
							copied++;
						}
						break;
					}
				}
			}
		}
	} finally {
		old.close();
	}
	return copied;
}

/** Called from the read-mode session start hook. */
export async function offerVibereaderMigration(npub: string): Promise<void> {
	if (await db.kv.get<boolean>(MIGRATED_KEY)) return;
	const names = (await indexedDB.databases?.()) ?? [];
	if (!names.some((d) => d.name === `vibereader::${npub}`)) return;

	toast.info('Found a VibeReader library in this browser', {
		description: 'Copy its books, files, and annotations into PlebChat? Your VibeReader data is left untouched.',
		duration: Infinity,
		action: {
			label: 'Copy',
			onClick: () => {
				void (async () => {
					try {
						const copied = await copyLibrary(npub);
						await db.kv.save(MIGRATED_KEY, true);
						await library.refresh();
						await sync.checkDirty();
						toast.success(`Copied ${copied} records from VibeReader`);
					} catch (err) {
						console.error(err);
						toast.error('Migration failed — your VibeReader data is unchanged');
					}
				})();
			}
		},
		cancel: {
			label: 'Never',
			onClick: () => {
				void db.kv.save(MIGRATED_KEY, true);
			}
		}
	});
}
