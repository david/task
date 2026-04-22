# Decision Batching

Use this reference for planning-heavy, investigation-heavy, or design-heavy work where the agent needs user input but should avoid turning progress into a long chain of micro-confirmations.

Typical users:
- `/skill:feature`
- `/skill:debug`
- `/skill:refactor`
- plan-only requests
- investigations that uncover policy or product questions
- implementation planning after an approved direction exists

## Purpose

Optimize for forward progress with low user steering burden.

Default stance:
- synthesize first
- ask only the decisions that materially change the work
- batch related questions together
- propose a coherent default model when possible
- treat user interruptions as costly

A good response usually gives the user something coherent to react to, not a long series of tiny approvals.

## When to apply it

Apply this workflow when:
- multiple related product or design choices are emerging
- the agent can see several likely decisions at once
- the user has already signaled the broad direction and only details remain
- the work would otherwise devolve into "one question per message"

Do not treat this as a ban on asking questions. Use it to decide:
- which questions are truly blocking
- which can be grouped
- which can be handled by a stated default and revised later

## Default workflow

### 1. Separate blocking decisions from non-blocking details

Before asking anything, classify each open point:
- **blocking** — changes implementation shape, migration strategy, public contract, risk, or architecture
- **important but non-blocking** — affects polish or preference, but a reasonable default exists
- **detail** — can be deferred, inferred, or captured as a follow-up note

Ask about blocking decisions first.

### 2. Propose a coherent draft before asking for many answers

Prefer:
- a short synthesis of current understanding
- one proposed model or plan
- a small set of explicit open decisions

Example shape:
- "Here is the model I think matches current behavior."
- "I see three decisions that materially affect implementation."
- "If you do not object, I will assume X for the rest."

Do not make the user assemble the model by answering twenty tiny prompts.

### 3. Batch related decisions

Ask in clusters, not singletons.

Good batching patterns:
- all schema naming questions together
- all render-policy questions together
- all migration-policy questions together
- all compatibility / rollout questions together

Prefer 3-5 related decisions in one pass over a long serial chain.

### 4. State defaults explicitly when they are safe

If a reasonable default exists, say it and keep moving.

Good examples:
- "Unless you want compatibility, I will assume a direct rename."
- "I will treat editor suggestions as out of scope unless you want them now."
- "I will preserve current behavior where the evidence is clear."

Defaults are best when they are:
- reversible
- low-risk
- consistent with current behavior
- easy for the user to correct in one reply

### 5. Interrupt only for material forks

Pause for confirmation when the answer would materially change:
- schema shape
- migration semantics
- architecture boundaries
- user-visible policy
- risk surface
- verification strategy

Do not interrupt for every naming preference, implementation detail, or speculative edge case.

### 6. Watch for pacing feedback

Treat these as signals to reduce interaction overhead:
- "just go"
- "please inspect the code well"
- "no more than that"
- repeated corrections to your framing
- signs the user is re-explaining context you should already be carrying

When this happens:
- stop meta-narrating
- stop announcing readiness
- stop adding extra optional branches
- switch to a stronger defaulting and batching mode

## Heuristics

Prefer asking when:
- multiple plausible answers would lead to different code or migration paths
- the decision is product-sensitive and evidence cannot resolve it
- the user has already signaled that the choice matters

Prefer assuming and stating the assumption when:
- current behavior gives a strong default
- the choice is local and easy to revise
- the decision does not affect the plan's backbone
- the user has already indicated the broader preference

## Anti-patterns

Avoid these unless you can say why they are necessary:
- one-message-per-decision planning
- asking a question immediately after the user already gave enough direction
- re-opening settled decisions without new evidence
- framing every detail as if it needs explicit approval
- pacing chatter like "ready for the next section" when the user wants momentum
- making the user do synthesis that the agent could have done

## Deliverable expectations

A good planning or diagnosis response should usually include:
- a concise synthesis of the current understanding
- the proposed model, diagnosis, or plan
- the small set of remaining blocking decisions
- explicit assumptions for everything else

If there are no true blocking decisions, proceed without asking more questions.

## Rule of thumb

Prefer:
- coherent proposals
- batched questions
- explicit defaults
- fewer interruptions
- quick adaptation to pacing feedback

over:
- serial micro-confirmations
- repeated "does that sound right?"
- asking about every branch as soon as it appears
- conversational progress that depends on constant user steering
