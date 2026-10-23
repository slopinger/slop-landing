# Bloon Assembly

An independent balloon tower-defense game in handwritten WebAssembly text assembly (WAT),
compiled with WABT's `wat2wasm`. Play at https://freifick.net/arcade/bloons/.

**Target: the features of Bloons TD 6, as explicitly requested. This is an intermediate development
build, not a feature-complete BTD6 clone.** Do not mark the overall work complete because an
intermediate milestone passes.

## Current build

Six towers: dart (sharp single target), tack (radial), bomb (explosive splash), ice (freeze), super
(rapid sharp shots), ninja (camo detection). All six currently use three generic linear upgrades.
BTD6's named three-path upgrade trees, projectile/pierce mechanics and exact tower stats remain
pending; the ninja is a partial implementation, not its completed BTD6 tower.

One original map supports a 40-round campaign using the first 40 standard BTD6 round groups,
counts and spawn timings, ending with the first MOAB. The build encodes the numeric data from
`rounds.json` into WAT; the assembly scheduler handles overlapping groups at 60 Hz.
A pinned source URL in that JSON records the
[BTD6 API Explorer round-data snapshot](https://github.com/BTD6ApiExplorer/BTD6ApiExplorer.github.io/tree/2bac15126b7a67c7e2c7e1fd167606a4285cdb90/data/roundsets).
Only numeric gameplay facts and identifiers were extracted; no third-party executable code or
art was copied. End-of-round income is 100 + round; shell damage counts toward pops, but
multi-HP shells pay once on destruction.

The 17 base types run from red through BAD, including black, white, purple, lead, zebra,
rainbow, ceramic and all five standard blimp classes. Shells spawn their actual child families;
ordinary overkill penetrates children, while blimp shells absorb excess damage. Camo detection,
explosive/cold/sharp/energy/fire/plasma immunities, frozen sharp resistance, regrow ancestry,
regrown-layer cash/pop suppression, fortified shell HP and inheritance are implemented.
Leak damage includes the remaining descendants and partially damaged outer shell.
The type statistics are pre-freeplay values; rounds 81+ scaling and super ceramics are pending.
The current tower roster cannot counter every sandbox balloon (notably DDT lead/camo/black
properties); their required tower upgrade counters remain part of the unfinished work.

Sandbox starts with ample cash/lives and lets visitors send all 17 types, select camo/regrow/
fortified properties, choose batch counts and clear balloons while preserving towers.
Invalid modifiers are normalized: only lead, ceramic and blimps retain fortification; blimps
cannot regrow; DDTs always have camo and spawn camo regrow ceramic children.
First / Last / Close / Strong targeting is implemented in assembly for dart, bomb, super and
ninja towers. Radial tack and ice attacks have no target-priority selector.

The balloon pool holds 4096 entities. If a split would exceed capacity, it is deferred and a
visible capacity warning appears; no descendants are silently dropped. Nested overkill reserves
slots for sibling children, preventing partial allocation from corrupting state.

Browser controls support pointer/touch and keyboard placement, pause, 1x/2x/3x speed, opt-in
synthesized sound, restart confirmation and local best campaign round storage. Sandbox results
do not count as campaign records. Hiding the tab pauses play. Artwork is drawn in canvas;
no Ninja Kiwi images, audio or executable code are included.

## Build and verify

```sh
nix build
nix flake check
nix develop -c bash tools/build-bloons.sh
nix develop -c node tools/test-bloons.mjs
nix develop -c python3 -m http.server 8768 --bind 127.0.0.1 --directory site
```

Generated `site/arcade/bloons/engine.wasm` and `engine.wat` are ignored.
`tools/encode-rounds.mjs` only encodes checked-in numeric data; it does not implement game rules.
The package encodes, assembles, validates, tests and installs assets in a network-free Nix sandbox.
The browser never fetches a compiler or runtime dependency. The engine has no imports.

`tools/test-bloons.mjs` instantiates the actual Wasm. It verifies all type families/RBE/fortified HP,
immunity combinations, DDT descendants, overkill boundaries, regrow ancestry and cash/pop
accounting, real attack targeting, freeze behavior, 4096-slot pressure including nested splits,
sandbox isolation and clearing, invalid placement, economy and terminal lifecycle.
It checks every spawn in all 40 rounds against the source table, including tick timestamps and
overlapping groups. A full campaign uses only earned cash, survives without lost lives, and
matches the source table's complete 12,289 RBE and cumulative income. Controlled fixture tests
edit memory only to isolate cases; the campaign grants no extra cash, lives or damage.

CI: https://hydra.kyouma.net/jobset/slop-landing/main, site and backend checks on x86_64-linux and
aarch64-linux. Deployment follows the root README through the slop-landing input in nixfiles.

## Engine ABI v2

One fixed 512 KiB exported memory. Little-endian 32-bit integer/float fields.

| Region | Layout |
| --- | --- |
| Header 0..43 | i32 cash, lives, round, phase, pops, active balloons, pending round spawns, total ticks, sandbox flag, pool-pressure warning, round ticks |
| Type stats 512..1055 | 17 immutable 32-byte records: i32 shell HP; f32 relative speed; i32 first child type/count, second child type/count, strength rank, visual radius |
| Group counters 2048..2559 | i32 spawned counts for current round's groups |
| Towers 12288..14591 | 48 slots, 48 bytes: i32 active; f32 x,y; i32 type,upgrade level,cooldown; f32 target x,y; i32 pops,investment,target priority; 4 reserved bytes |
| Effects 24576..30719 | 256 slots, 24 bytes: f32 x,y,target x,target y; i32 lifetime,type |
| Balloons 65536..327679 | 4096 slots, 64 bytes, fields below |
| Round index 327680..328191 | immutable round-number-indexed pairs of i32 group pointer/count |
| Round groups from 328192 | immutable 24-byte records: i32 type,flags,count,start tick,end tick,reserved |

Balloon offsets: 0 active; 4/8/12 f32 progress/x/y; 16 HP; 20 type; 24 freeze ticks; 28 hit flash;
32 property flags; 36 regrow ancestry bitset; 40 growth timer; 44 damage-credit history bitset;
48 birth tick; 52 uncredited shell damage; 56 last attack serial; 60 cash-credit history bitset.
Every field except progress/x/y is i32. Property flags: camo 1, regrow 2, fortified 4.
Type IDs: red 0, blue 1, green 2, yellow 3, pink 4, black 5, white 6, purple 7, lead 8, zebra 9,
rainbow 10, ceramic 11, MOAB 12, BFB 13, ZOMG 14, DDT 15, BAD 16.

Phases: 0 ready, 1 running, 2 defeat, 3 victory. Target priorities: first 0, last 1, close 2,
strong 3. Fixed frequency: 60 ticks/second. Effects are visual records; attacks currently resolve
without projectile travel. `pool_end()` bounds iteration over allocated balloon records.

Exports: `reset(sandbox=0)`, `start`, `step`, `cost(type)`, `range(type,level)`,
`position(distance,axis)`, `can_place(x,y)`, `place(type,x,y)`,
`upgrade_cost(id)`, `upgrade(id)`, `sell(id)`, `targeting(id,priority)`,
`health(type,flags)`, `rbe(type,flags)`, `pool_end()`,
`can_damage(type,flags,frozenTicks,kind,camoDetection)`,
`send_bloon(type,flags,count)`, `clear_bloons()`.
`sandbox_strike(slot,damage,kind,camoDetection)` exercises the same hit routine for sandbox
verification and rejects campaign use; it is not a campaign damage shortcut.
Damage kinds: sharp 0, explosive 1, cold 2, energy 3, fire 4, plasma 5, normal 6.
`place` returns a slot or -1; mutators reject invalid indices and terminal campaign purchases.

## Remaining BTD6 scope

Baseline feature inventory: [Ninja Kiwi's BTD6 product description](https://store.steampowered.com/app/960090/Bloons_TD_6/).
The accepted scope remains full feature parity with **6**, not the first Flash game. Pending:

- Every tower with its distinct projectile/attack/pierce behavior, all three named upgrade paths,
  crosspath restrictions, tier-five uniqueness, activated abilities, transformations, sacrifices
  and applicable paragons. Current generic upgrades must be replaced, not relabeled.
- Heroes, placement restrictions, XP levels, abilities, upgrades and hero-specific mechanics.
- Rounds 41 onward, alternate round sets, freeplay and health/speed scaling, super ceramics,
  specialized enemies and full interactions with every unimplemented tower/ability.
- Map catalog and map mechanics: paths, water, obstacles, line of sight, removables and interactions.
- All difficulties and modes including CHIMPS restrictions, complete sandbox controls,
  challenge/editor rules, boss events, races, odysseys, quests and other event variants.
- Progression/save/resume, currencies, unlocks, monkey knowledge, achievements, powers,
  insta-monkeys, collection and customization systems.
- Co-op/lobbies/synchronization, social/team/event systems and challenge sharing.
- Faithful economy, balancing, UI flows, audio/visual feedback and accessibility; per-feature
  comparison against the target version and end-to-end regression coverage.

The live BTD6 catalog changes over time. Before claiming parity, inventory its current release
against primary Ninja Kiwi release notes and check every feature against the running clone.
A catalog or button with no implemented behavior does not satisfy a feature.
