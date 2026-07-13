#!/usr/bin/env bash
# Publish kind-0 profiles + kind-3 follow lists for the whitelisted test
# accounts (alice/bob/carol) so they show up by name in Browse libraries'
# friend selector. Each account follows the other two.
#
# Repeatable on purpose: relay.abvstudio.net purges events older than 60
# days, so re-run when the profiles vanish. Requires `nak` and the
# gitignored key file in the nostr-ecash-ecosystem repo.
set -euo pipefail

ACCOUNTS_FILE="${ACCOUNTS_FILE:-$(dirname "$0")/../../my-projects/.test-accounts.json}"
RELAY="${RELAY:-wss://relay.abvstudio.net}"

sec() { jq -r ".accounts[] | select(.name==\"test-$1\") | .privkey" "$ACCOUNTS_FILE"; }
pub() { jq -r ".accounts[] | select(.name==\"test-$1\") | .pubkey" "$ACCOUNTS_FILE"; }
display() { echo "$(tr '[:lower:]' '[:upper:]' <<<"${1:0:1}")${1:1}"; }

for name in alice bob carol; do
	profile=$(jq -nc --arg n "$name" --arg d "$(display "$name")" \
		'{name: $n, display_name: ($d + " (test)"), about: "PlebChat test account — not a real person", picture: ("https://robohash.org/" + $n + ".png?set=set4")}')
	echo "kind 0 for $name:"
	nak event -k 0 -c "$profile" --sec "$(sec "$name")" "$RELAY"

	follows_args=()
	for other in alice bob carol; do
		[ "$other" = "$name" ] && continue
		follows_args+=(-t "p=$(pub "$other")")
	done
	echo "kind 3 for $name:"
	nak event -k 3 -c '' "${follows_args[@]}" --sec "$(sec "$name")" "$RELAY"
done

echo "Done — verify with: nak req -k 0 -k 3 -a $(pub alice) $RELAY"
