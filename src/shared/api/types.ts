// Domain types come from the generated OpenAPI schema — never hand-copied
// (RULE-API-001). Regenerate with `pnpm api:types` after pulling a new
// openapi/gogo.v1.yaml from GoGo-BE.
import type { components, operations, paths } from './schema'

export type { components, operations, paths }

type Schemas = components['schemas']

export type ErrorEnvelope = Schemas['ErrorEnvelope']
export type FieldError = ErrorEnvelope['field_errors'][number]
export type Money = Schemas['Money']
export type TokenGrant = Schemas['TokenGrant']

export type RoomSummary = Schemas['RoomSummary']
export type RoomMember = Schemas['RoomMember']
export type RoomConstraintInput = Schemas['RoomConstraintInput']
export type RoomType = RoomSummary['type']
export type RoomStatus = RoomSummary['status']
export type DecisionMode = RoomSummary['decisionMode']
export type RoomRole = NonNullable<RoomSummary['myRole']>
export type MemberSelectionStatus = RoomMember['selectionStatus']
export type BudgetMode = RoomConstraintInput['budgetMode']

export type PlaceSearchResult = Schemas['PlaceSearchResult']
export type PlaceDetail = Schemas['PlaceDetail']
export type PricePerPerson = Schemas['PricePerPerson']
export type OpenState = Schemas['OpenState']
export type AreaPredictions = Schemas['AreaPredictions']
export type TaxonomyList = Schemas['TaxonomyList']

export type SuggestionsCurrent = Schemas['SuggestionsCurrent']
export type SuggestionCandidate = Schemas['SuggestionCandidate']
export type VoteValue = NonNullable<SuggestionCandidate['myVote']>

export type Plan = Schemas['Plan']
export type PlanStop = Schemas['PlanStop']
export type PlanTotals = Schemas['PlanTotals']
export type PlanStopStatus = NonNullable<PlanStop['status']>

export type Checkin = Schemas['Checkin']
export type Review = Schemas['Review']
export type SavedItem = Schemas['SavedItem']
export type Notification = Schemas['Notification']
export type NotificationKind = Schemas['NotificationKind']
export type ResolveLinkResult = Schemas['ResolveLinkResult']
export type SubmissionResult = Schemas['SubmissionResult']

// --- operation helpers ------------------------------------------------------
// Endpoint wrappers derive their signatures from these so a contract change
// surfaces as a typecheck failure rather than a runtime surprise.

type SuccessStatus = 200 | 201 | 202 | 204

type JsonOf<T> = T extends { content: { 'application/json': infer C } } ? C : never

// A handful of operations declare a 200 with a description but no schema. Those
// collapse to `void` rather than `never` so call sites stay usable — the spec
// gap is tracked in docs/adr/0001-api-integration.md.
type OrVoid<T> = [T] extends [never] ? void : T

/** Success response body for an operation (`void` when it declares no JSON). */
export type OpResponse<Op extends keyof operations> = OrVoid<
  {
    [S in Extract<keyof operations[Op]['responses'], SuccessStatus>]: JsonOf<
      operations[Op]['responses'][S]
    >
  }[Extract<keyof operations[Op]['responses'], SuccessStatus>]
>

/** Request body for an operation. */
export type OpBody<Op extends keyof operations> = JsonOf<operations[Op]['requestBody']>

/** Query parameters for an operation. */
export type OpQuery<Op extends keyof operations> =
  operations[Op]['parameters'] extends { query?: infer Q } ? NonNullable<Q> : never

/** Path parameters for an operation. */
export type OpPath<Op extends keyof operations> =
  operations[Op]['parameters'] extends { path?: infer P } ? NonNullable<P> : never
