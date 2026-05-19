# SDNV ↔ FieldMetriq Webhook State

**Date:** 2026-05-19
**Commit at investigation:** `7571974`
**Status:** Of the **2 new v1 outbound events** the contract requires SDNV to send (`palette.revised`, `selection.changed`), **0 are implemented** — and the upstream domain (palette / selection entities, designer publish action) doesn't exist on SDNV either. Of the **1 existing inbound event** (`job.completed`), the receiver is **working but on the v0 auth scheme**; whether v1 conventions retroactively apply is a contract-ambiguity question. The `/api/paint-colors` proxy is **fully working**.

---

## Contract summary

(Source: [`contract-fm-sdnv-integration.md`](contract-fm-sdnv-integration.md), v1.0, 251 lines.)

### Direction of data flow

Bidirectional. Three channels:

1. **FM → SDNV (existing, v0):** `job.completed` webhook + `GET /api/paint-colors` proxy + deep links to `/colors/<brand>/<code>`.
2. **SDNV → FM (new in v1):** Two outbound webhook events from SDNV to `https://fieldmetriq.com/api/webhooks/sdnv/palette`.
3. **No additional inbound events** in v1 (no new FM → SDNV channels).

### Events SDNV must emit to FM (outbound, v1)

| Event | Trigger | Payload shape (key fields) | Required? |
|---|---|---|---|
| `palette.revised` | "Designer publishes a whole-palette update on SDNV" | `event`, `version`, `occurredAt`, `actor{type,id,displayName,email}`, `palette{sdnvProjectId, fmLeadId, revision, items[], notes}` — each item has `sdnvItemId, category, roomTag, tradeTag, sortOrder` plus a category-specific payload (`paint{}`, `countertop{}`, etc.) | yes |
| `selection.changed` | "Designer swaps a single palette entry (color change, product swap)" | `event`, `version`, `occurredAt`, `actor{...}`, `change{sdnvProjectId, fmLeadId, sdnvItemId, fmSelectionId, changeType, fields{before/after}, reason}`. `changeType` ∈ {`swap`, `update`, `remove`} | yes |

### Events SDNV must receive from FM (inbound)

| Event | Trigger | Payload | Status in repo |
|---|---|---|---|
| `job.completed` | Contractor marks project complete | `{event, job{jobId, clientName, serviceType, neighborhood, completionDate, contractorId, workDescription}}` | **Working** (v0 scheme) |

The contract explicitly says: *"Kept as-is for v1 backward compatibility."* See "Contract gaps" below for ambiguity about whether the new auth conventions retroactively apply.

### Endpoint, auth, retry

- **Outbound endpoint (SDNV → FM):** `https://fieldmetriq.com/api/webhooks/sdnv/palette` (new). One URL for both events; event type is in the body.
- **Inbound endpoint (FM → SDNV):** `https://www.sublimedesignnv.com/api/webhooks/fieldmetriq` (existing).
- **Authentication:** Symmetric HMAC-SHA256 with **two secrets** (per-direction):
  - `FIELDMETRIQ_WEBHOOK_SECRET` — signs FM → SDNV (exists in `.env.example`)
  - `SDNV_WEBHOOK_SECRET` — signs SDNV → FM (**missing** from `.env.example`, set on both sides)
- **Signature scheme (v1):** signed string is `${timestamp}.${body}` (raw JSON bytes). Receiver verifies before parsing.
- **Headers (v1):**
  - `X-Webhook-Signature: sha256=<hex-hmac>`
  - `X-Webhook-Timestamp: <unix-seconds>`
  - `X-Webhook-Id: <uuid-v4>`
- **Replay protection:** reject requests older than 5 minutes.
- **Idempotency:** reject (or short-circuit with `{ok:true, duplicate:true}`) on repeat `X-Webhook-Id` within 24 hours. Requires a persistence layer.
- **Retry semantics (sender):** 5 attempts at immediate, 30s, 2m, 15m, 1h. Retry on 5xx + network failures only. 4xx is permanent failure → log to dead-letter table.
- **Receiver SLA:** must return 2xx within 5 seconds. Async processing OK after accept.
- **Error response shape:** `{ ok: false, error: "<code>", message: "<human readable>" }` with 4xx status.
- **Success response shape:** `palette.revised` → `{ok:true, changesLogged:<n>}`; `selection.changed` → `{ok:true, changeId:<logId>}`; duplicates → `{ok:true, duplicate:true}`.
- **Content-Type:** `application/json; charset=utf-8`. Raw bytes are signed — parse after verify.
- **Versioning:** every payload carries `version`; both receivers accept previous major for 30 days during rollout.

### Identifier mapping (per contract)

| Concept | FM ID | SDNV ID | How mapped |
|---|---|---|---|
| Project | `Lead.id` (cuid) on FM | `sdnvProjectId` (string) | `Lead.sdnvProjectId` column on FM side |
| Palette item | `LeadPaletteSelection.id` on FM | `sdnvItemId` (string) | `LeadPaletteSelection.sdnvItemId` on FM side |
| Designer (user) | n/a | `sdnv-user-<id>` | Snapshotted into FM's `PaletteDecisionLog`; FM does not maintain a Designer table |

Contract does **not** specify what SDNV-side field provides `sdnvProjectId` — could be `Project.id`, `Project.slug`, a brand-new column, or a free-form designer-typed string. Same gap for `sdnvItemId`.

### Contract gaps (things the contract doesn't specify)

1. **What SDNV field maps to `sdnvProjectId`** in outbound payloads. Contract describes FM's storage but not SDNV's source-of-truth column.
2. **Whether v1 auth scheme retroactively applies to the existing `job.completed` flow.** The contract says it's "kept as-is for v1 backward compatibility," which the existing payload section interprets as payload-only; the global "Shared conventions" section doesn't carve out the legacy endpoint. The two readings disagree.
3. **Dead-letter table schema/owner.** Each side is told to log to "a dead-letter table" but no shared schema or location is specified.
4. **Designer identity source.** `actor.id` is `"sdnv-user-<id>"` style — what's the user table on SDNV side? There's an admin email allowlist (`ADMIN_ALLOWED_EMAILS`) but no `User` model with stable IDs.
5. **What `actor.email` privacy implications are.** Embedded in inbound payload to FM and snapshotted into FM's decision log. No data-retention guidance.
6. **Whether the existing receiver's response shape needs to change.** Currently returns `{ received: true, projectId, projectSlug, uploadUrl, projectUrl }` — contract says success is `{ok: true, ...}`. Same backward-compat ambiguity.

---

## SDNV-side implementation today

### Files involved

| Path | Purpose | Wired in? |
|---|---|---|
| [`src/app/api/webhooks/fieldmetriq/route.ts`](src/app/api/webhooks/fieldmetriq/route.ts) | Inbound receiver for `job.completed`. Verifies HMAC-SHA256 over raw body. Maps `serviceType` → `serviceSlug`, parses `completionDate`, creates draft `Project` record, returns dashboard upload URL. | **Yes** — bound by Next.js routing at `POST /api/webhooks/fieldmetriq`. |
| [`src/app/api/paint-colors/route.ts`](src/app/api/paint-colors/route.ts) | Outbound proxy: `GET /api/paint-colors?q=&brand=&limit=`. CORS allow-list pinned to FM origins (`https://fieldmetriq.com`, `https://www.fieldmetriq.com`, localhost dev). | **Yes** — bound at `GET/OPTIONS /api/paint-colors`. |
| `.env.example` | Declares `FIELDMETRIQ_WEBHOOK_SECRET` (line 38). | **Yes** — read at [`webhooks/fieldmetriq/route.ts:51`](src/app/api/webhooks/fieldmetriq/route.ts#L51). |

**No other FM-related code exists in `src/`, `scripts/`, or `prisma/`.** Specifically:
- No outbound webhook sender (no `emitFM`, no `sendToFieldMetriq`, no `webhooks/sdnv/` directory).
- No HMAC signing helper (only the verifier exists, inline in the receiver).
- No `sdnvProjectId` / `sdnvItemId` columns in `prisma/schema.prisma`.
- No `WebhookSeen` / idempotency table.
- No palette/selection entities in the data model (`grep palette` against `prisma/schema.prisma` returns nothing; matches in `src/` are UI-token false positives).

### Existing receiver — conformance check against v1 conventions

The existing [`webhooks/fieldmetriq/route.ts`](src/app/api/webhooks/fieldmetriq/route.ts) was built to the v0 contract. Against v1's "Shared conventions":

| v1 requirement | Existing receiver | Verdict |
|---|---|---|
| Header `X-Webhook-Signature: sha256=<hex>` | Reads `x-fieldmetriq-signature` ([`route.ts:50`](src/app/api/webhooks/fieldmetriq/route.ts#L50)) | **Diverges** |
| Signed string is `${timestamp}.${body}` | Signs raw body only ([`route.ts:6`](src/app/api/webhooks/fieldmetriq/route.ts#L6)) | **Diverges** |
| Header `X-Webhook-Timestamp` + reject >5min | Not parsed, not validated | **Missing** |
| Header `X-Webhook-Id` + 24h idempotency dedup | Not parsed, no persistence | **Missing** |
| Success: `{ok:true, ...}` | Returns `{received:true, projectId, projectSlug, uploadUrl, projectUrl}` ([`route.ts:129-135`](src/app/api/webhooks/fieldmetriq/route.ts#L129-L135)) | **Diverges** |
| Failure: `{ok:false, error, message}` with 4xx | Returns `{error:"Invalid signature"}` 401 / `{error:"Invalid JSON"}` 400 ([`route.ts:54,61`](src/app/api/webhooks/fieldmetriq/route.ts#L54)) | **Partially diverges** (missing `ok:false`, missing `message`) |
| Response time ≤ 5s | Synchronous DB upsert; should be well under 5s for current load | **OK** |

Whether these divergences need fixing depends on Contract Gap #2 (v1-applies-retroactively?). See open questions.

### Trigger-point analysis (outbound events)

#### `palette.revised`

- **Contract trigger:** "Designer publishes a whole-palette update on SDNV."
- **SDNV trigger location(s):** **None.** No admin/dashboard surface for designer palette publishing exists.
- **Currently emits?** **No.**
- **Notes:** Upstream domain entirely missing — no `LeadPalette` / `PaletteRevision` / `PaletteItem` Prisma models, no admin UI, no `revision` counter, no publish action. This is a greenfield build, not a wiring fix.

#### `selection.changed`

- **Contract trigger:** "Designer swaps a single palette entry."
- **SDNV trigger location(s):** **None.** Same gap as above.
- **Currently emits?** **No.**
- **Notes:** Same as above — there is no entity to "swap."

### Env vars

| Variable | In `.env.example`? | Used in code? | Documented value? |
|---|---|---|---|
| `FIELDMETRIQ_WEBHOOK_SECRET` | Yes ([line 38](.env.example)) | Yes — [`webhooks/fieldmetriq/route.ts:51`](src/app/api/webhooks/fieldmetriq/route.ts#L51) | Yes (comment block lines 35–37) |
| `SDNV_WEBHOOK_SECRET` | **No** | **No** | **No** |
| `FIELDMETRIQ_WEBHOOK_URL` / outbound URL | **No** | **No** | **No** |

The hardcoded outbound URL would be `https://fieldmetriq.com/api/webhooks/sdnv/palette` per contract — should still live in an env var for staging/dev/prod parity.

---

## Gap analysis

### 🔴 Blocking gaps (must build for any v1 outbound integration to work)

1. **No outbound sender.** No code, no helper, no module. Needs an HMAC-SHA256 signer + transport (with retry schedule, timestamp/UUID generation, idempotency-key emission, 5-attempt retry with exponential backoff to a dead-letter store).
2. **No palette / selection domain.** No Prisma models, no admin UI for designer publish/swap actions, no `revision` counter, no `sdnvItemId` generation, no concept of "publishing" a palette. Without this, the events have nothing to emit.
3. **`SDNV_WEBHOOK_SECRET` not provisioned.** Not in `.env.example`, not in code. Must be added to both sides' env config and the actual secret value generated + shared via secure channel.
4. **Outbound endpoint URL not parameterized.** Should be `FIELDMETRIQ_WEBHOOK_URL` env var, not hardcoded.
5. **Dead-letter persistence undefined.** Contract requires logging permanent failures somewhere; SDNV has no schema for it.
6. **No designer/user identity model.** Contract's `actor.id` shape (`sdnv-user-<id>`) implies a stable user record. SDNV currently has `ADMIN_ALLOWED_EMAILS` (env-list-based auth) — no `User` table. Need either a designer table or a contract-acknowledged mapping (e.g., use email as the `id`).

### 🟡 Partial implementations

1. **Existing inbound `job.completed` receiver** works against v0 but diverges from v1 conventions on header name, signed-string format, timestamp validation, idempotency, and response shape (see conformance table above). Whether to upgrade depends on Contract Gap #2.

### 🟢 Already working

1. **`GET /api/paint-colors` proxy.** Matches contract — CORS-pinned to FM origins, returns name/code/brand-filtered paint colors. No changes needed.
2. **FM → SDNV `job.completed` happy path** (against v0 contract). Verifies signature, creates a `Project` row, returns dashboard upload URL. Functionally complete; question is only whether to also bring it onto v1 conventions.

---

## Recommended build sequence

The blocking gaps split cleanly into infrastructure (one sprint) and domain (multiple sprints). Recommend 4 sprints:

1. **Sprint A — Outbound webhook plumbing (no events yet).**
   - Add `SDNV_WEBHOOK_SECRET` + `FIELDMETRIQ_WEBHOOK_URL` to `.env.example`.
   - Build a single `src/lib/webhooks/sendToFieldMetriq.ts` helper: signs `${timestamp}.${body}` with HMAC-SHA256, generates `X-Webhook-Id` UUID, retries on 5xx/network per contract schedule (immediate / 30s / 2m / 15m / 1h, 5 attempts).
   - Add `WebhookDeadLetter` Prisma model for permanent failures.
   - Add `WebhookSeenInbound` Prisma model (for future Sprint D inbound idempotency upgrade).
   - Tests: signs canned payloads, retries on injected 503, gives up after 5 attempts.

2. **Sprint B — Palette domain model + admin "publish" surface.**
   - Prisma models: `Palette` (per project, revision counter), `PaletteItem` (with `sdnvItemId` cuid, category-specific JSON payload, roomTag/tradeTag/sortOrder), join to `Project` or a new `DesignerProject` entity that maps to FM's `Lead.id` via `fmLeadId` column.
   - Decide: does `sdnvProjectId` = `Project.id`, `Project.slug`, or a new dedicated column? Document the choice in the contract.
   - Admin UI: minimum viable "view palette / publish revision" page. Publish increments `revision` and triggers an event.
   - No outbound webhook yet — just the domain + state transitions.

3. **Sprint C — Wire `palette.revised` outbound.**
   - In the publish handler from Sprint B, after the DB commit, call `sendToFieldMetriq("palette.revised", payload)`.
   - Payload shape per contract §1 (with all category-specific fields the schema supports).
   - Fire-and-forget through the retry helper; persist `fmLeadId` and the revision number on the SDNV row so a re-publish overwrites.

4. **Sprint D — Wire `selection.changed` outbound + (optional) upgrade existing receiver to v1.**
   - Add admin UI for single-item edit with `changeType` selector (`swap` / `update` / `remove`) and a `reason` text field.
   - Compute `fields{from,to}` diff in the handler, fire `selection.changed`.
   - **Optional:** depending on Open Question #1 below, also upgrade the existing FM→SDNV receiver to v1 header/signature/idempotency conventions. This is its own ~half-sprint if pursued.

Sprints A and B can be done in parallel by two people; C depends on both; D depends on C.

---

## Open questions

Need Brandon's (and possibly Tyler's) input before Sprint A can start in earnest:

1. **Does v1 auth retroactively apply to the existing `job.completed` flow?** The contract says payload is "kept as-is" but is silent on whether the new signature scheme (timestamped HMAC), header names, and response shape apply. **Decision needed:** either explicit grandfather clause for the legacy endpoint, or schedule the v0 → v1 upgrade in Sprint D.
2. **What is `sdnvProjectId` in SDNV's data model?** Pick one:
   - `Project.id` (cuid, stable, exists today)
   - `Project.slug` (human-readable, exists today, but mutable)
   - A new dedicated column (most explicit, allows projects without `Project` rows yet)
   The contract is silent on this; FM only cares about it as an opaque string. Recommend `Project.id` unless there's a reason designers would publish palettes before a project row exists.
3. **Designer identity.** Contract uses `actor.id = "sdnv-user-<id>"` and `actor.email`. SDNV has no `User` table — admin auth is email-allowlist via `ADMIN_ALLOWED_EMAILS`. Two options:
   - Use the admin's email as both `id` and `email` (`actor.id = "sdnv-user-<email-hash>"` or just the email).
   - Add a minimal `User` / `Designer` table.
   Recommend option (a) for v1 — defer the user table until there's a real need.
4. **Has `SDNV_WEBHOOK_SECRET` been generated and shared?** Need a 32+ byte random value provisioned in both SDNV and FM env stores before Sprint C goes live. (Sprint A can build against a placeholder.)
5. **Is FM's `POST /api/webhooks/sdnv/palette` endpoint live in staging?** Sprint A's retry helper can be tested against a local mock, but Sprint C smoke-test needs a real FM endpoint accepting signed v1 payloads. Check with FM-side team.
6. **What's the deduplication scope for `X-Webhook-Id`?** Contract says "last 24 hours." Does that mean a 24h sliding window per-id, or a 24h retention with cleanup? Sprint A will assume sliding-window (simpler) unless told otherwise.
