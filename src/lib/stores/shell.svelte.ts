// App-shell state shared across modes. `immersive` hides the TopBar for
// full-viewport views (the reader, a future workspace) — the owning mode
// sets it in an $effect and must clear it when its view exits.

let immersive = $state(false);

export const shell = {
	get immersive() {
		return immersive;
	},
	setImmersive(value: boolean) {
		immersive = value;
	}
};
