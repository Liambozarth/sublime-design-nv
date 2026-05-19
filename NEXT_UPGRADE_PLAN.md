# SDNV Next.js Upgrade Plan

**Current version:** `next@14.2.35` — the final 14.2 patch; no more backports
**Latest stable:** `next@16.x`
**Recommendation:** **Option B — staged 14 → 15 → 16**, in two sprints, when next-auth v5 GA ships
**Estimated effort:** 4–6 Claude Code sprints total (10–16 focused hours)
**Created:** 2026-05-19

---

## Why this plan exists

[DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md) flagged 14 Next.js advisories against `14.2.35`. Research after that audit confirms `14.2.35` is the final patch on the 14.2 line — Vercel has stopped backporting security fixes. The only path to closing the remaining 8 advisories (after Sprint 5 Part A's `npm audit fix` dropped the count from 14 → 8) is migrating to Next 15 or 16.

This document inventories what that migration would specifically require for SDNV, based on direct grep of the codebase at commit `cae1150`.

**Key surprise from the inventory:** The migration is already **~45% done**. 18 of 40 dynamic-route files already use the async `params: Promise<...>` pattern, mostly in the newer lead-flow, intake, vision, and social paths. The materials catalog, project/supplier/color pages, and the admin assets API still use the legacy sync `params: { id: string }` shape. The codemod will handle most of the rest.

---

## Migration path options

### Option A — Direct jump to Next 16

- **Pros:** Closes all 8 remaining advisories in one shot. Single round of regression testing.
- **Cons:** Two majors of stacked breaking changes (14 → 15 plus 15 → 16). Higher single-step failure risk. Less isolatable bisect if something breaks.

### Option B — Staged 14 → 15 → 16 (recommended)

- **Pros:** Smaller blast radius per step. The 14 → 15 jump is by far the larger surface (async APIs, React 19, fetch caching defaults). The 15 → 16 jump is mostly image-optimization tightening. Isolating them makes regression triage trivial.
- **Cons:** Twice as many test cycles. The 8 advisories remain open for the duration of Sprint A (the 14 → 15 step). Most of those advisories are also resolved at 15, so this isn't a big delay.

**Recommendation: Option B.** SDNV has no test suite (per audit Section 3), which makes regression bisection painful. Splitting the upgrade lets us deploy 14 → 15 to Vercel preview, exercise the admin + intake + vision paths manually, then proceed to 15 → 16 only after the first step is confirmed stable in prod. The cost of one extra sprint is far less than the cost of debugging a regression across two majors with no test net.

---

## Codebase touchpoints — what actually has to change

### 1. Async Request APIs (Next 14 → 15)

In Next 15, the previously-synchronous APIs `cookies()`, `headers()`, `draftMode()`, and the `params`/`searchParams` props on pages, layouts, route handlers, and metadata functions all became async (return Promises).

**Findings in SDNV:**

| API | Occurrences | Status |
|---|---|---|
| `cookies()` | 0 | ✅ Nothing to change |
| `draftMode()` | 0 | ✅ Nothing to change |
| `headers()` | 1 | ✅ **Already migrated** — [src/app/layout.tsx:70](src/app/layout.tsx#L70) uses `await headers()` |
| `params: Promise<...>` (async, migrated) | 18 files | ✅ Done |
| `params: { foo: ... }` (sync, **needs migration**) | **22 files** | 🔴 To do |
| `searchParams` references | 21 files | 🟡 Each needs review — sync today, must `await` in Next 15 |

**The 22 files with sync `params` that need migration:**

```
src/app/colors/[brand]/[colorSlug]/page.tsx
src/app/gallery/[service]/[material]/page.tsx
src/app/materials/[material]/page.tsx
src/app/materials/[material]/[slug]/page.tsx
src/app/projects/[slug]/page.tsx
src/app/services/[service]/[location]/page.tsx
src/app/suppliers/[slug]/page.tsx
src/app/api/admin/assets/[id]/colors/[colorId]/route.ts
src/app/api/admin/assets/[id]/colors/route.ts
src/app/api/admin/assets/[id]/debug/route.ts
src/app/api/admin/assets/[id]/gallery/route.ts
src/app/api/admin/assets/[id]/hero/route.ts
src/app/api/admin/assets/[id]/publish/route.ts
src/app/api/admin/assets/[id]/route.ts
src/app/api/admin/leads/[id]/route.ts
src/app/api/admin/materials/[id]/pricing/route.ts
src/app/api/admin/materials/[id]/route.ts
src/app/api/admin/materials/manufacturers/[id]/route.ts
src/app/api/admin/materials/suppliers/[id]/route.ts
src/app/api/admin/projects/[id]/debug/route.ts
src/app/api/admin/projects/[id]/finishes/route.ts
src/app/api/admin/projects/[id]/route.ts
```

**Mitigation:** Run the official codemod:

```bash
npx @next/codemod@latest next-async-request-api .
```

It handles `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` automatically. Manual review still needed for files where the codemod can't infer call-site context (typically: when `params` is destructured into a typed-but-not-trivial variable, or when it's passed through wrappers).

**Estimated effort for this step:** 2–3 hours (codemod run + manual review of all 22 files + tsc verification + spot-check a few admin routes in dev).

---

### 2. React 18 → 19 (Next 15 prerequisite)

Next 15 requires React 19 (or React 18 with concurrent features enabled). SDNV is currently on React 18 (`"react": "^18"`, `"react-dom": "^18"`, `"@types/react": "^18"` in [package.json](package.json)).

**Findings in SDNV:**

| Pattern | Occurrences | Notes |
|---|---|---|
| `useFormState` (renamed to `useActionState` in React 19) | **0** | ✅ Nothing to change |
| `forwardRef` (still works but deprecated in favor of ref-as-prop) | **0** | ✅ Nothing to change |

SDNV is in unusually clean shape for the React 18 → 19 jump. The breaking changes that catch most apps either aren't in use here (`useFormState`, `forwardRef`, `propTypes`, defaultProps on function components) or are type-level annoyances that the React codemod can sweep.

**Mitigation:**

```bash
npx codemod@latest react/19/migration-recipe
npm install react@19 react-dom@19 @types/react@19 @types/react-dom@19
```

**Estimated effort:** 1–2 hours (install + codemod + tsc + lint).

---

### 3. Fetch caching defaults changed (Next 14 → 15)

In Next 14, `fetch()` calls in Server Components and Route Handlers were cached by default. In Next 15, they are **not** cached by default. Code that relied on implicit caching needs explicit `cache: "force-cache"` or revalidation config.

**Findings in SDNV:**

- **25 files** in `src/app/` contain `fetch(` calls.
- Top callers:
  - [src/app/admin/social/page.tsx](src/app/admin/social/page.tsx) — 10 calls (client-side, not affected by SSR caching change)
  - [src/app/admin/materials/page.tsx](src/app/admin/materials/page.tsx) — 8 calls (client-side)
  - Plus admin/media/page.tsx, admin/social/pinterest/page.tsx, etc.
  - Server-side callers: [src/app/api/admin/social/post-instagram/route.ts](src/app/api/admin/social/post-instagram/route.ts), [src/app/api/admin/social/auth/instagram/callback/route.ts](src/app/api/admin/social/auth/instagram/callback/route.ts), [src/app/api/admin/social/auth/facebook/callback/route.ts](src/app/api/admin/social/auth/facebook/callback/route.ts)

**Risk:** Most SDNV `fetch()` calls are in admin client components (fetching to internal `/api/admin/*` routes) where caching is undesirable anyway — Next 15's new behavior is what these calls effectively want. The server-side calls are to external APIs (Meta Graph, OpenAI, Cloudinary) where caching responses is generally wrong. **Most likely outcome: net positive change, no manual fixes needed.**

**Mitigation:** Audit each `fetch()` after the upgrade — confirm none relied on default caching for performance. Add explicit `cache: "force-cache"` only where needed.

**Estimated effort:** 1 hour audit + targeted fixes (probably 0–2 sites need explicit cache config).

---

### 4. `serverComponentsExternalPackages` renamed (Next 14 → 15)

`next.config.mjs` currently has:

```ts
experimental: {
  serverComponentsExternalPackages: ["pg", "@prisma/adapter-pg"],
},
```

In Next 15, this moved to top-level `serverExternalPackages` (no longer under `experimental`).

**Mitigation:** One-line config rename. The Next 15 upgrade codemod handles it.

**Estimated effort:** 5 minutes.

---

### 5. Image optimization defaults (Next 15 → 16)

Next 16 tightened the default for `images.qualities` (only `[75]` permitted by default) and other image config defaults.

**Findings in SDNV:**

- **1 occurrence** of `quality=` prop on Image components: [src/components/CloudinaryImage.tsx:36](src/components/CloudinaryImage.tsx#L36) — `quality="auto"`. This is a Cloudinary-specific value, not a Next/Image quality value; effectively passes through to Cloudinary URL transformation. **Not affected by Next 16's restriction.**
- **12 files** import or use `<Image>` from `next/image`.
- Current `next.config.mjs` `images` config:
  ```ts
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  ```
  Standard. No `qualities`, `deviceSizes`, or `imageSizes` overrides.

**Risk: low.** SDNV uses Cloudinary for actual image transformation (size, quality, format) and Next/Image only for layout + lazy-loading. Next 16's image config tightening shouldn't affect production rendering.

**Mitigation:** Verify image rendering on a couple of project / paint-color / portfolio pages in preview after the Next 16 step. No proactive config changes expected.

**Estimated effort:** 30 min smoke testing.

---

### 6. `next-auth@5.0.0-beta.30` — the highest risk

SDNV's entire admin auth path ([src/lib/auth.ts](src/lib/auth.ts), [src/middleware.ts](src/middleware.ts), 47 admin API routes that call `requireAdminApiSession()`) runs on a beta of next-auth v5.

**Risks compounding through the Next upgrade:**

- next-auth v5 GA may ship before, during, or after the Next upgrade. Compatibility with Next 15/16 is not yet validated by upstream.
- Middleware execution semantics changed in both Next 15 and Next 16. SDNV's middleware does auth gating *and* sets the `x-standalone` header for layout switching — both behaviors must survive.
- Session/JWT callbacks in next-auth v5 betas have evolved between versions; upgrading next-auth simultaneously with Next is asking for trouble.

**Mitigation strategy (this is the single most important sequencing decision):**

1. **Before starting the Next upgrade**, check whether Auth.js v5 GA has shipped (https://authjs.dev/getting-started/installation). 
2. If **GA shipped**: do a standalone `next-auth` GA upgrade sprint *first*. Verify admin login → admin route access → API protection still works end-to-end. Only then proceed to Next.
3. If **still beta**: choose between (a) waiting for GA, (b) pinning next-auth at the current beta and praying the Next upgrade is compatible, (c) upgrading to whatever the latest beta is and treating that as part of the Next sprint scope. Option (a) is safest if there's no urgency to close the Next advisories.
4. Either way, the auth path needs full manual testing after both the next-auth and Next upgrades.

**Estimated effort:** unknown — depends on whether next-auth GA ships in time. Budget 2–4 sprints for the upgrade alone if GA is out.

---

### 7. Middleware semantics

[src/middleware.ts](src/middleware.ts) gates `/admin`, `/dashboard`, `/intake`, `/vision`, `/kiosk` routes via `auth()` from next-auth, and sets an `x-standalone: 1` response header to drive layout choice in [src/app/layout.tsx](src/app/layout.tsx).

**Risks:**

- Next 15 and 16 both made changes to middleware execution semantics and the `auth()` wrapper from next-auth. Specific concerns:
  - The middleware `matcher` config syntax is unchanged but the matching order on overlapping paths has subtle differences.
  - Response header propagation through `NextResponse.next()` was tightened in Next 15.
  - The `request.auth` extension provided by next-auth's `auth()` wrapper depends on next-auth internals that may change between betas.

**Mitigation:** Manual end-to-end test of the gated routes after each major bump:
- Anonymous request to `/admin/photos` → must redirect to `/admin/login`.
- Authenticated allowlisted email → must reach `/admin/photos`.
- Anonymous request to `/intake/<valid token>` → must show intake form (token-gated, not session-gated).
- Anonymous request to `/api/admin/leads` → must return 401.

**Estimated effort:** 30 min manual testing, in both the 14 → 15 and 15 → 16 verification passes.

---

### 8. Other potentially-affected areas

- **`@prisma/adapter-pg`** — React 19 ships with a new compiler. Adapter-pg has no React touchpoints, so should be unaffected. Verify on build.
- **Cloudinary `next-cloudinary@^6.17.5`** — peer-depends on Next; check changelog for Next 15/16 compatibility before upgrading.
- **`heic2any@0.0.4`** — client-side only, no Next dependency.
- **`react-masonry-css@1.0.16`** — unmaintained (last release 2022). Used in gallery layout. May break under React 19; have an alternative (`react-photo-album`, plain CSS columns) ready as a fallback.

---

## Risk assessment

| Component | Risk | Why |
|---|---|---|
| **Auth path** (middleware + lib/auth.ts + admin API gating) | **HIGH** | Beta next-auth + middleware semantics changes in two majors. A regression here means admin lockout or, worse, public admin endpoints. |
| **Dynamic routes with sync `params`** (22 files) | **MEDIUM** | Mechanical change but covers many user-facing routes (materials catalog, projects, paint colors, gallery). A missed file = 500 errors. Codemod handles 95%. |
| **Server-side `fetch()` calls** | **LOW** | Default change usually invisible; most SDNV uses are to external APIs that shouldn't be cached anyway. |
| **`<Image>` rendering** | **LOW** | Cloudinary does the transformation; Next 16 image-quality restriction unlikely to bite. |
| **`react-masonry-css`** | **LOW** | If it breaks under React 19, swap for alternative is a 1-sprint job. |
| **Build / deploy** | **LOW** | Vercel handles the Next version change cleanly; `dotenv` shim from Sprint 4 Part A keeps local builds working. |

---

## Recommended next steps

1. **Do nothing yet.** No urgent CVE forces this now. The 8 remaining advisories are all DoS / cache-poisoning / SSRF / cache-poisoning-of-RSC — real but no active exploit chain against SDNV's traffic patterns. Continue monitoring `npm audit` weekly.
2. **Wait for `next-auth` v5 GA.** Track https://authjs.dev/getting-started/installation. Auth is the highest-risk component; do not co-migrate with Next.
3. **When GA ships, run a dedicated next-auth upgrade sprint** (~2–4 hours): bump version, verify admin login + all admin API gating + middleware redirects in dev + preview.
4. **Then run the Next 14 → 15 sprint** (~3–4 hours): codemod + manual review of 22 sync-`params` files + config rename + smoke test gated routes.
5. **Then run the Next 15 → 16 sprint** (~2–3 hours): minor compared to 14→15; mostly image-config defaults and final smoke testing.
6. **After Next 16 is stable in prod**, run `npm audit` once more — count should be near 0.

---

## Open questions

| Question | Why it matters | Who decides |
|---|---|---|
| When does Auth.js (next-auth) v5 GA ship? | Gates step 2. If GA never ships, we eventually have to migrate on a late beta. | Upstream — out of SDNV's control |
| Is there a hard deadline (compliance, Vercel deprecation, customer requirement) for closing the 8 remaining advisories? | If yes, may need to compress the schedule. If no, defer-and-monitor is fine. | Brandon / Tyler |
| Acceptable downtime / regression risk in the admin dashboard during the upgrade? | Determines whether we can ship to prod and verify, or whether we need a full preview-environment pass first. | Brandon |
| Should we add a minimal test suite (Vitest, even 5 tests covering auth + quote + intake) before the upgrade as a safety net? | A 5-test suite catches ~80% of upgrade regressions for a fraction of the cost of a real test culture. | Brandon |
| Is `react-masonry-css` worth replacing pre-upgrade as a defensive move, or wait until it actually breaks? | If unmaintained gallery library breaks under React 19, gallery pages go down. Pre-emptive swap is cheap. | Brandon |
