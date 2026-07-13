# Cover sync

**Status: proposed, not scheduled.** Book covers currently don't travel with
metadata sync — this proposal weighs the options. The schema change itself,
when accepted, lands in `docs/nostr-event-model.md` (the binding contract),
not here.

## What is true today

- **Metadata edits already update the "book announcement" event.** Kind 30101
  is addressable (`d` = the file's sha256), and every field in the edit
  dialog (title, creator, publisher, language, ISBN, description) lives in
  its content. Editing bumps `updatedAt`; the next explicit sync republishes
  the *same* event (same kind, same `d`), which replaces the old version on
  relays. No change needed for that half of the ask.
- **The cover is NOT in the 30101 event.** Its content is JSON metadata only.
  The only way cover bytes leave the device today is the per-book **Blossom
  file backup**: `backupBook()` uploads the EPUB *and* the cover blob, and
  records `blossom: { servers, coverSha256 }` in the book record (and thus in
  30101). `restoreBook()` re-extracts the cover from the EPUB bytes, falling
  back to downloading `coverSha256`.
- Consequences of that gap:
    - A **ghost book** (metadata pulled, file not on this device) has no
      cover unless the book was Blossom-backed-up.
    - **Browse** (someone's public shelf) shows no covers.
    - A **replaced cover** (edit dialog) is device-local forever — and a
      restore overwrites it with the EPUB-embedded one.

## Constraints

1. **Relay event size**: our default relay caps events at **32 KB**
   (`maxEventSize = 32768`, strfry.conf; strfry's own default is 64 KB —
   design for 32 KB so we work on the strictest relay we know of).
2. **NIP-44 inflation**: private 30101 content is NIP-44-to-self ciphertext,
   base64-encoded — payload bytes inflate ~4/3, twice (base64 image inside
   JSON, then base64 ciphertext). Working backwards from a 30 KB event
   budget: plaintext JSON ≤ ~22 KB → base64 cover ≤ ~20 KB → **raw cover
   image ≤ ~15 KB**. (NIP-44's own plaintext ceiling is 64 KB — not the
   binding limit here.)
3. **Design rule 2 (private by default)**: a private book's cover must not
   leak. Anything that puts the cover on a public-by-hash Blossom server
   trades a little privacy (covers reveal what you read to the server
   operator, and to anyone holding the hash).
4. **Design rule 5 (explicit only)**: cover upload/download must ride the
   existing explicit actions (import, edit-save, Sync, backup) — no new
   background transfers.

## Option A — inline thumbnail in 30101 content

Add an optional field to the 30101 content schema (and the local `Book`
record it mirrors):

```jsonc
"cover": { "data": "<base64 jpeg>", "mimeType": "image/jpeg" }  // ≤ 12 KB raw
```

- **Encode**: at import and at edit-save, derive a thumbnail from the cover
  blob — 2:3 center-crop, ≤ 192×288, JPEG with a quality loop that walks
  down until the encoded size is under a hard 12 KB cap (skip the field if
  even q=0.4 can't fit, e.g. pathological images). The full-resolution cover
  blob stays in the local `covers` store; the thumbnail is only the wire
  format.
- **Decode**: when a pulled 30101 wins LWW and carries `cover`, write it to
  the `covers` store — but only if the local cover is absent or the remote
  record is strictly newer (the same rule the rest of the record already
  follows).
- **Degradation ratchet, and its fix**: device B receives the thumbnail; if
  B re-encoded a thumbnail *of that thumbnail* on its next push, quality
  would decay generation by generation. Fix: tag cover records with
  `origin: 'original' | 'synced'`; when encoding a draft from a `synced`
  cover, reuse the stored base64 verbatim instead of re-encoding. Stable
  after one hop.
- **Shared books**: the plaintext variant carries the same field → browse
  and ghost books get covers for free, for every reader. (~16 KB plaintext
  event — comfortably inside 32 KB.)
- **Pros**: zero new infrastructure; works for private books (cover rides
  inside the ciphertext — no leak); covers ghost books, browse, and
  edited-cover propagation in one move; additive schema change (old events
  simply lack the field; vibereader-era events unaffected).
- **Cons**: thumbnail quality only (~192×288 — fine for cards and browse,
  not for a large book-detail view); fattens every 30101 from ~1 KB to
  ~15–20 KB (sync pulls a few hundred KB for a 30-book shelf — acceptable,
  but no longer negligible); permanently spends half the 32 KB event budget.

## Option B — standalone Blossom cover, pointer in the event

Decouple the cover upload from the full-file backup: upload the cover blob
alone (10–100 KB — cheap) at import/edit/sync time, and put the pointer in
the content:

```jsonc
"cover": { "sha256": "<cover-sha256>", "servers": ["https://…"] }
```

Receivers fetch missing covers by hash after a sync pull (explicit action:
the sync click covers it).

- **Pros**: full resolution; events stay ~1 KB; this is the architecturally
  "pure" split (relays for events, Blossom for blobs — PHILOSOPHY.md).
- **Cons**:
    - **Privacy**: violates constraint 3 for private books — the cover
      becomes a public-by-hash blob and the Blossom server sees
      pubkey ↔ cover. Would need to be opt-in or shared-books-only, which
      reintroduces the gap for private books.
    - **Availability**: requires a working Blossom server. Known ecosystem
      state (CLAUDE.md gotchas): nostr.download is the *only* usable public
      default, and the homelab has no Blossom server yet. Cover display on
      a new device would hard-depend on a third party staying up.
    - More failure modes (CORS, 4xx, server churn) for a cosmetic feature.

## Option C — hybrid (recommended)

**A is the baseline, the existing backup path is the enhancement.**

- Inline thumbnail in 30101 per Option A → every synced/browsed/ghost book
  has a card-quality cover, private books included, no new dependencies.
- Keep `blossom.coverSha256` exactly as it works today (full-res cover
  uploaded alongside the file at backup time). Display preference:
  local original → Blossom full-res (already fetched on restore) → synced
  thumbnail.
- Don't build B's standalone cover upload at all unless a real need for
  full-res covers on file-less devices shows up.

## Implementation sketch (when scheduled)

1. `docs/nostr-event-model.md`: add the optional `cover` field to the 30101
   schema (doc-first, per its ownership header).
2. `db/types.ts`: `Cover` gains `origin: 'original' | 'synced'` (additive;
   existing records default to `'original'`). `Book` does NOT grow a field —
   the thumbnail is derived at encode time, keeping "the grid never touches
   blobs" true.
3. `read/nostr/events.ts`: `bookDraft()` gains the thumbnail encode
   (quality-loop ≤ 12 KB, verbatim pass-through for `origin: 'synced'`);
   `parseRemote()`/`parseForeign()` pass `cover` through.
4. `read/nostr/sync.ts`: on a winning 30101 pull, save the decoded cover
   (absent-or-newer rule). `browse`/ghost stores render foreign covers from
   the parsed field.
5. Edit dialog: unchanged — replacing a cover already bumps `updatedAt`,
   which is what makes the next sync carry it.
6. e2e: encode→decode roundtrip with a fixture cover; two-profile live gate:
   replace cover on A, sync, cover appears on B (and on B's ghost card).

## Open questions

- Thumbnail budget: 12 KB raw is conservative against the 32 KB relay cap —
  could go to ~20 KB if we accept being near the ceiling on relays we don't
  control. Start conservative.
- Should shared 30101s *also* carry a standard `image` tag (URL) when a
  Blossom cover exists, for interop with generic nostr clients that render
  link previews? Cheap, but only meaningful once shelves are consumed
  outside PlebChat. Defer.
- WebP instead of JPEG (~30 % smaller at equal quality, universal decode
  support by now)? Probably yes at implementation time; the schema's
  `mimeType` field already allows it.
