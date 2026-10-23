# Bloon Assembly

An independent balloon tower-defense game in handwritten WebAssembly text assembly (WAT),
compiled with WABT's `wat2wasm`. Play at https://freifick.net/arcade/bloons/.

**Target: the features of Bloons TD 6, as explicitly requested. This is an intermediate development
build, not a feature-complete BTD6 clone.** The first milestone is an independently playable and
deployable engine. Do not mark the overall work complete because this milestone passes.

## Current build

Five towers: dart (single target), tack (radial), bomb (splash, breaks lead), ice (area damage and
slow), super (rapid fire). Each currently has three linear generic upgrades, rather than BTD6's
three named upgrade paths. One original map and a deterministic 30-round test campaign include
red/blue/green/yellow/pink layers, lead and ceramic shells, and blimps every tenth round.
Placement validation, spending, upgrades, selling at 75%, targeting, hits, cash rewards and win/loss
are implemented in WAT. Current prices, stats, enemy hierarchy and rounds are provisional.

Browser controls support pointer/touch and keyboard placement, pause, 1x/2x/3x speed, opt-in
synthesized sound, restart confirmation and local best round storage. Hiding the tab pauses play.
Artwork is drawn in canvas; no Ninja Kiwi images, audio or executable code are included.

## Build and verify

```sh
nix build
nix flake check
nix develop -c bash tools/build-bloons.sh
nix develop -c node tools/test-bloons.mjs
nix develop -c python3 -m http.server 8768 --bind 127.0.0.1 --directory site
```

Generated `site/arcade/bloons/engine.wasm` and `engine.wat` are ignored. The package assembles,
validates, tests and installs both from `assembly/bloons.wat` in a network-free Nix sandbox.
The browser never fetches a compiler or runtime dependency. The engine has no imports.

`tools/test-bloons.mjs` instantiates the actual Wasm. It covers invalid/overlapping placement,
NaN rejection, cash/upgrade/sell rules, track geometry, lead resistance, slowing, rapid fire,
wave lifecycle, defeat, victory, terminal-state immutability and an entire 30-round campaign using
only earned cash. Controlled fixtures directly edit memory only for isolated attack tests; the
campaign does not grant extra cash, lives or damage.

CI: https://hydra.kyouma.net/jobset/slop-landing/main, site and backend checks on x86_64-linux and
aarch64-linux. Deployment follows the root README through the slop-landing input in nixfiles.

## Engine ABI v1

One fixed 64 KiB exported memory. Little-endian 32-bit integer/float fields.

| Region | Layout |
| --- | --- |
| Header 0..31 | i32 cash, lives, round, phase, pops, active balloons, spawns remaining, ticks |
| Balloons 1024..9215 | 256 slots, 32 bytes: i32 active; f32 progress,x,y; i32 hp,type,slow ticks,hit flash |
| Towers 12288..14591 | 48 slots, 48 bytes: i32 active; f32 x,y; i32 type,upgrade level,cooldown; f32 target x,y; i32 pops,investment; 8 reserved bytes |
| Effects 24576..30719 | 256 slots, 24 bytes: f32 x,y,target x,target y; i32 lifetime,type |

Phases: 0 ready, 1 running, 2 defeat, 3 victory. Fixed simulation frequency: 60 ticks/second.
Effects are visual records; hits resolve in the simulation without browser callbacks.
Exports: `reset`, `start`, `step`, `cost(type)`, `range(type,level)`,
`position(distance,axis)`, `can_place(x,y)`, `place(type,x,y)`,
`upgrade_cost(id)`, `upgrade(id)`, `sell(id)`.
`place` returns a slot or -1; mutators reject invalid indices and terminal-game purchases.

## Remaining BTD6 scope

Baseline feature inventory: [Ninja Kiwi’s BTD6 product description](https://store.steampowered.com/app/960090/Bloons_TD_6/).
The baseline includes tower paths and abilities, heroes, paragons, maps, co-op, events,
community content, monkey knowledge, powers and insta-monkeys.

The accepted scope remains full feature parity with **6**, not the first Flash game. These
are pending implementation and verification, not advertised features:

- Every tower with its distinct attack behavior, all three upgrade paths, crosspath restrictions,
  tier-five uniqueness, activated abilities, transformations, sacrifices and applicable paragons.
- Heroes, placement restrictions, XP levels, abilities, upgrades and hero-specific mechanics.
- Full balloon hierarchy and child spawning; black/white/purple/zebra/rainbow, camo, regrow,
  fortified, lead, frozen interactions; MOAB/BFB/ZOMG/DDT/BAD behavior and scaling.
- Actual regular and alternate round tables, round 100 BAD, freeplay, targeting priorities,
  projectile travel/collision/pierce, damage types and buffs/debuffs.
- Map catalog and map mechanics: paths, water, obstacles, line of sight, removables and interactions.
- All difficulties and modes including CHIMPS restrictions, sandbox, challenge/editor rules,
  boss events, races, odysseys, quests and other event variants.
- Progression/save/resume, currencies, unlocks, monkey knowledge, achievements, powers,
  insta-monkeys, collection and customization systems.
- Co-op/lobbies/synchronization, social/team/event systems and challenge sharing.
- Faithful economy, balancing, UI flows, audio/visual feedback and accessibility; per-feature
  comparison against the target version and end-to-end regression coverage.

The live BTD6 catalog changes over time. Before claiming parity, inventory its current release
against primary Ninja Kiwi release notes and check every feature against the running clone.
A catalog or button with no implemented behavior does not satisfy a feature.
