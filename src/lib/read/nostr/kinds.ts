// Read mode's custom addressable kinds (docs/nostr-event-model.md — owned by
// PlebChat, inherited verbatim from VibeReader for continuity with deployed
// events). 30079–30165 is unassigned in the NIPs registry; 30105/30106 reserved.
export const KIND_BOOK = 30101;
export const KIND_PROGRESS = 30102;
export const KIND_SETTINGS = 30103;
export const KIND_ANNOTATION = 30104;

// Standard kinds used as-is.
export const KIND_DELETE = 5; // NIP-09
export const KIND_HIGHLIGHT = 9802; // NIP-84 (compat export on share)
export const KIND_BLOSSOM_SERVERS = 10063; // BUD-03
export const KIND_BLOSSOM_AUTH = 24242; // BUD-11

// Kept as 'vibereader' so settings synced by the superseded app keep merging;
// migrating this d-tag is documented as PlebChat's first owned protocol change.
export const SETTINGS_D_TAG = 'vibereader';
