# GOGO-589 — Step B

Notifications, Explore and Saved use the shared PullToRefresh / LoadingIndicator.
Manual refresh on cursor queries cancels pending pagination, keeps cached page one,
removes later pages and their cursors, and refetches the first page. Subsequent
load-more follows the newly returned cursor. Saved refetches its collection and
place details using its existing non-paginated contract.

The notifications toolbar (including the filter chips) sits below AppHeader,
outside the scrolling feed. Empty, filtered-empty and system-empty states use the
shared EmptyState, illustration and Vietnamese/English pull-down guidance. Empty
states have no reload button; failure recovery keeps its retry actions.

Explore and system notifications request 10 items per page. Personal and system
cursor feeds retain load-more, footer loading and retry behavior.

Contract gaps (API unchanged):

- GET /me/saved returns a collection without cursor pagination or a limit parameter.
- GET /me/notifications returns nextCursor but exposes no page-size parameter;
  the client cannot request a guaranteed page size of 10.

Validation on 2026-11-09:

- pnpm typecheck: pass.
- pnpm lint: pass, no warnings.
- Targeted Jest: Notifications, Explore, Saved, system-notification query and saved-entry query suites.
- npx vitest run and pnpm test: each 1693 passed, 39 skipped, 3 failed in
  src/shared/config/__tests__/distribute-wrapper.test.ts. The sandbox denies ps;
  these failures concern distribution process ownership/group checks.
- Cursor-reset tests exercise fresh cursor traversal, cancellation of pending
  load-more and cached first-page retention after refresh failure.
- No simulator verification in this task. No git commands, commits or API changes.
