# GOGO-244 — return to an existing decision

The lobby offers an explicit return action when freshly confirmed room and
suggestion data identify a non-stale run. In vote/match mode, an incomplete
ballot opens the deck; host mode or a completed ballot opens results, using the
same destination rule as automatic routing. Back continues to stay in the lobby.
The action performs navigation only: it does not save preferences or start a run.

Automated coverage lives in `room-status-routing.spec.tsx`: return after Back
for host/member and decision modes, completed ballots, a stale run, and a room
returning to collecting. Existing cached-state and routing tests cover the
freshness and once-per-run guards. No API or business-rule change is needed.

DEV acceptance remains required on a build containing the fix: on each physical
platform leave a vote, return through the lobby action, and verify the original
run ID, preference version and non-stale status remain unchanged. Repeat after
completing a ballot to verify the results destination. Do not count a run using
unmodified develop as acceptance of this patch.

Rollback: revert this change; no migration or stored-state changes.

Refs #244
