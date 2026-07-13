/**
 * Default nostr relays and cashu mints passed to <Cyphertap>.
 *
 * relay.abvstudio.net is our own strfry relay. Its write policy is a pubkey
 * whitelist — freshly generated keys are rejected by design during the test
 * phase (log in with a whitelisted test account, or add the hex pubkey to
 * ~/.strfry/whitelist.d/ on the homelab). It also purges events older than
 * 60 days, so it is not durable storage.
 *
 * The default mint is TEST infrastructure (fake ecash, no real funds).
 * Note: mints only apply when a NEW NIP-60 wallet is created — an existing
 * wallet keeps the mint list from its own wallet event.
 */
export const RELAYS = ['wss://relay.abvstudio.net', 'wss://relay.primal.net'];

export const MINTS = ['https://nofee.testnut.cashu.space'];
