# Authentication / Authorization Analysis

Use this reference when work may affect:
- backend routes
- slice navigation auth requirements
- org-scoped or self-scoped resources
- signer or public routes
- token-based access
- frontend role-based navigation or visibility
- 403 vs 404 behavior

Before proposing changes, read:
- `doc/authorization.md`

## Required outputs

When relevant, every feature spec, diagnosis, or refactor plan must include an
explicit access section. Do not bury access rules inside validation prose.

## Scan-first presentation

Lead with a compact summary table, then expand only the rows that matter.

### Access summary table

| Surface | Actor(s) | Auth mode | Scope rule | Current | Proposed | Failure shape | Enforcement point |
|---|---|---|---|---|---|---|---|
| `POST /api/things` | `admin`, `super_admin` | `session` | `same-org` | `same` | `+transaction_coordinator` | `403` | route auth + handler |
| `/sign/:id/review` | `signer` | `token` | `signing-session only` | `same` | `same` | `403` | token hook + lookup |

Use canonical delta notation in the `Current` and `Proposed` style cells when useful:
- `same`
- `+role`
- `-role`
- `~own->org`
- `validated(token)`
- `404-not-visible`
- `403-unauthorized`

## What to cover

### 1. Authentication

State:
- whether the surface is authenticated, public, or token-based
- what credential or session is required
- any changes to token/session requirements
- any signer-specific or assisted-signing-specific requirements

### 2. Authorization

State:
- which actors may perform the action
- which actors may see the resource
- which actors must be denied
- whether access is role-based, org-based, ownership-based, or signer-session-based

### 3. Visibility / scoping

State:
- cross-org visibility rules
- same-org ownership rules
- list scoping rules
- whether denial should hide existence or acknowledge existence

### 4. Failure semantics

State the exact denial behavior:
- `403`
- `404`
- token rejection
- not authenticated / public
- other explicit failure shape

### 5. Enforcement points

Name where access is enforced:
- route `auth`
- token hook
- `webData`
- handler
- list/query scoping
- frontend nav filtering

Frontend filtering is never sufficient by itself; call out backend enforcement.

## Repo-specific checks

For this repo, explicitly check:
- `super_admin` cross-org behavior
- admin / transaction_coordinator org-wide access
- agent self-scoped access
- signer token access and session scoping
- assisted-signing distinctions when relevant
- 404-for-wrong-org vs 403-for-same-org unauthorized behavior
- frontend nav filtering vs backend enforcement

## Output quality bar

A plan is not ready if it only says:
- "requires auth"
- "admin only"
- "check permissions"
- "same access as before"

Instead, spell out:
- which actors are allowed
- which scope rule applies
- what denial shape the user gets
- where the enforcement actually lives
