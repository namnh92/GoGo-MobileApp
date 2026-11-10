# Chip spacing audit — GoGo-MobileApp #615 / #394

Owner rule, 2026-11-10: chip rows have at most 4pt between items on both axes.
`chipRowGap` in `src/shared/ui/tokens.ts` references `spacing[1]` (4pt).
There is no shared ChipRow component; existing row styles use this one value.
Chip touch targets remain at least 44pt.

## Screens with changed chip-row layouts

- GoGo AI: welcome suggestions, conversation follow-ups and clarifying answers, proposal editing, and place result cards.
- Home: mood filters and place cards.
- Explore/search: filter sheet, result cards, map selection cards, and empty-result suggestions.
- Saved places and Saved City: place cards.
- Profile: interest chips.
- Profile defaults: default-preference chips.
- Notifications: filter chips.
- My contributions: filters, contribution-card ratings.
- My reviews: filters and place-card ratings.
- Create outing — mood/preferences: mood, setting, spending style, and seed-place chips.
- Create outing — time: date shortcuts and time chips in the date/time sheet.
- Room preferences: taxonomy chips.
- Match result: reason chips, run-constraint chips, and place cards.
- Swipe/vote: run-constraint chips and place cards.
- Room lobby: role/guest/status badge spacing.
- Room management: budget-tier chips.
- Add place by link: contribution-wizard choices, existing-place result, resolved/submitted place cards.
- Place detail: taxonomy tags, ratings, and AI starter-question chips.
- Place reviews: sort chips.
- Report place: reason chips.
- Active outing: time/cost chips, place cards, and check-in tags.
- Outing plan: stop-status chips and place cards.
- Edit plan: compact place-card ratings.
- Shared result: winning place card.

Shared place-card changes cover taxonomy tags (6→4pt), photo badges (8→4pt),
and rating rows (8→4pt); compact rating stacks already used 4pt and now use the
same token. The named legacy row styles `import.chipRow`,
`place-detail.ratingRow`, `swipe.tagRow`, and `result-card.badges` also use the
token, including definitions with no current multi-chip caller.

## Audit boundary

Inspected every production Chip/RatingChips call site, shared card tag/badge
containers, assistant starter-question pills, and horizontal/wrapping layouts.
Single contextual/status chips need no inter-chip gap change. Button grids
(radius choices, calendar/time slots, wizard price fields), checkbox lists,
list/card spacing, and static onboarding illustrations are separate layouts.

## Regression coverage

`chip.spec.tsx` pins the shared value to numeric 4 and checks row, column, and
wrapping-axis gaps for the audited styles in every theme, with no distributed
justification. Rendered AI tests cover follow-ups, group-size choices, and budget
choices, along with their existing 44pt targets and dispatch behavior.
Existing Explore and Notifications layout tests now pin 4pt.

Jest checks layout constraints; native wrapping geometry has not been measured
on a simulator in this task.

## Validation

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test:ui --runInBand`: 237 suites, 3,514 tests, 11 snapshots passed.
- `pnpm test src/shared/ui/__tests__/chip-ownership.test.ts`: 3 tests passed.
- No git commands were run.
