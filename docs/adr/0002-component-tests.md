# ADR 0002 — A second test runner for component tests

Status: accepted · 2026-08-28 · Supersedes nothing

## Context

The quality gates ask for a state matrix: "every important screen must actually
render `screen × audience (couple | group-host | group-guest) × state (default |
loading | empty | error)` — a selector that only swaps a query param without
changing the render is a bug." The wording is deliberate. It is not enough to
test the function that decides what to show; the screen has to render, and two
audiences have to produce two different trees.

Nothing in the repo could render a screen. The existing vitest suites cover the
API client, view models, money and schedule — all pure TypeScript. vitest runs
them in a Node environment with two Expo native modules aliased to stubs.

Rendering a React Native component needs React Native itself, which ships Flow
source that Node cannot parse. Making vitest do it means transforming
`react-native` and every Expo package through Babel with a hand-written config,
then re-solving it after each upgrade. The community packages that wrap this are
young and none is maintained by Expo.

## Options

1. **Stretch vitest to render React Native.** One runner, one config. But the
   transform pipeline is ours to own, and it breaks on every SDK bump.
2. **Move everything to jest.** One runner. Costs a rewrite of four working
   suites and gives up vitest's speed on the pure-TypeScript tests, which are
   the ones run most often.
3. **Run both.** vitest keeps the pure suites; `jest-expo` — the preset Expo
   maintains for precisely this — renders screens.
4. **Skip component tests, rely on the simulator.** Driving the app by hand did
   find four real bugs, so it has value. But it is manual, slow, and cannot run
   in CI, so a permission regression would ship unnoticed.

## Decision

Option 3. Two runners, split by what they test, not by preference:

- `pnpm test` — vitest, `*.test.ts`, no renderer.
- `pnpm test:ui` — jest + `jest-expo` + `@testing-library/react-native`,
  `*.spec.tsx`, renders screens.
- `pnpm test:all` — both.

The extension separates them, so neither runner sees the other's files.

## Consequences

- Two configs to keep working through an SDK upgrade. Accepted: `jest-expo` is
  versioned with the SDK, which is what makes that upgrade survivable.
- `jest.setup.js` fakes the storage backends, the native glass module and the
  safe-area insets. It fakes no application code: the stores, the view models
  and the capability rules under test are the ones that ship. The glass mock
  reports the native module as unavailable, so the specs exercise the
  translucent-solid fallback — the path most devices take.
- pnpm nests packages under `.pnpm/<name>@<version>_<hash>/`, so the usual
  `transformIgnorePatterns` from the Expo docs never matches. The pattern here
  matches inside the `.pnpm` directory name instead.
- `@testing-library/react-native` v14 returns a promise from `render` and puts
  the queries on the `screen` singleton, so every spec awaits the render. The
  shared `renderScreen` helper does that once.
- These tests are not E2E. They render one screen with its data mocked; they do
  not prove a flow works end to end. The seven release-gate E2E flows still need
  a device harness, and four of them are already covered against a live backend
  by the contract suite.

## Verification

Both permission tests were mutation-checked: replacing `canRegenerate: isHost`
with `true`, and the room hub's `capabilities.isHost` gate with `true`, each
makes exactly the corresponding test fail. A test that cannot fail is not a gate.
