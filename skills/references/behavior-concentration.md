# Behavior Concentration / Duplication Analysis

Use this reference when feature planning, debugging, or refactor planning may
interact with existing business behavior and you need to detect whether the
same rule is implemented in multiple places.

## Purpose

Surface scattered or duplicated behavior early during research so plans do not:
- introduce a second authority for an existing rule
- miss drift between multiple implementations of the same rule
- treat a structural duplication problem as an isolated bug
- preserve accidental scattering when the better move is consolidation

## Required research output

After the first meaningful code pass, include a compact **Behavior
Concentration Scan** when behavior ownership is relevant.

| Behavior / Rule | Current locations | Likely canonical owner | Spread type | Risk | Recommended action |
|---|---|---|---|---|---|
| `Org access scoping` | route hook, query helper, UI filter | auth/query scope layer | scattered ownership | drift | consolidate |
| `Packet completion rule` | handler, component guard | handler | duplicated business rule | split authority | keep handler authoritative; UI derives only |

Use concise values for `Spread type` such as:
- `same`
- `intentional layered checks`
- `duplicated business rule`
- `scattered ownership`
- `derived-only mirror`
- `unclear owner`

Use concise values for `Recommended action` such as:
- `preserve`
- `consolidate`
- `extend existing owner`
- `delegate`
- `verify intentional duplication`

## What counts as behavior

Scan for duplication or scattering in:
- authorization and visibility rules
- validation rules with business meaning
- workflow transitions and status derivation
- eligibility rules
- side-effect trigger conditions
- event interpretation or consumer branching
- pricing, counting, or other derived business calculations
- frontend guards that may mirror backend decisions
- projector or query rules that may redefine domain meaning

## How to reason about ownership

For each important rule, ask:
1. What exact business behavior is this?
2. Where is it implemented today?
3. Are those sites all doing the same thing?
4. Which site should be the canonical owner?
5. Are the other sites authoritative, delegated, or merely mirrored for UX or representation?
6. If duplication remains, is it intentional, bounded, and low-drift?

## Acceptable vs risky duplication

### Usually acceptable

These often repeat shape or representation, not business authority:
- boundary parsing plus domain invariant enforcement
- denormalized read-model data
- UI affordances that mirror backend capability checks for UX only
- logging or metrics repeated at different layers for observability

### Usually risky

These often create multiple authorities for business meaning:
- the same eligibility rule decided independently in frontend and backend
- multiple layers each owning access or visibility logic
- multiple processors or handlers triggering the same business side effect
- status or workflow transitions derived differently in different places
- copied validation with business meaning that can drift independently

## Output quality bar

Do not stop at "there may be duplication." State:
- the specific behavior
- the current implementation sites
- the likely canonical owner
- whether the spread is intentional or unsafe
- whether the current task should preserve, consolidate, or route to refactor

## Routing guidance

- **feature**: prefer extending an existing owner over introducing a second one
- **debug**: treat drift between duplicated implementations as a first-class root-cause category
- **refactor**: name the consolidation target and which sites should delegate or stop owning behavior
