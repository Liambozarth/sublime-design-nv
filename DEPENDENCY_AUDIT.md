# SDNV Dependency Audit — 2026-05-19

**Audit command:** `npm audit`
**Date:** 2026-05-19
**Total findings:** 6 moderate, 8 high — **14 total**
**Commit at time of audit:** `e03ab46` (post Sprint 4 Part A)

---

## Executive summary

Most of the 14 findings are in dev-only or build-time dependency chains (ESLint, Prisma Studio, Tailwind's file watcher) and present no runtime exposure to production traffic. The real action items are two: **(1) bump `next@14.2.35` to the latest 14.2.x patch release** — the Next.js advisories cover image-optimization DoS, request smuggling, cache poisoning, XSS, and SSRF, all of which affect runtime, and the 14.2 patch line should resolve most without forcing a breaking jump to Next 16; and **(2) check `lodash@4.17.23` which arrives via `cloudinary@2.9.0`** and is the only flagged transitive on the runtime path. Everything else is "monitor, batch into a planned upgrade cycle" — no fire-drill required.

`npm audit fix` (non-breaking) should close ~6 of 14 findings. `npm audit fix --force` would push `next` to 16 and `eslint-config-next` to 16 — do not run unprepared. Two off-audit risk items also worth tracking: `next-auth@5.0.0-beta.30` (beta dep on the critical auth path) and `react-masonry-css@1.0.16` (unmaintained since 2022).

---

## Findings by bucket

### 🔴 Bucket 1 — Real risk, fix soon

| Package | Version | Severity | Direct? | Vuln type | Fix | Breaking? |
|---|---|---|---|---|---|---|
| **`next`** | `14.2.35` | **HIGH** (14 advisories rolled up) | **Direct** runtime | DoS in image optimizer + request smuggling in rewrites + cache poisoning in RSC + CSP-nonce XSS + SSRF in WebSocket upgrades + middleware/proxy bypass + i18n bypass + others | Bump to latest `14.2.x` patch (not via `audit fix --force`, which jumps to 16) | Patch upgrade non-breaking; `audit fix --force` to 16 is breaking |
| **`lodash`** | `4.17.23` | **HIGH** | Transitive via `cloudinary@2.9.0` (RUNTIME) | Code injection via `_.template` import keys; prototype pollution via `_.unset` / `_.omit` array-path bypass | `npm audit fix` (non-breaking) | No — non-breaking |

**Why these are Bucket 1:**

- **`next`**: All advisories are against runtime code paths SDNV exercises — `next/image` is used everywhere, App Router server components are the entire stack, middleware gates auth on `/admin`, `/dashboard`, `/intake`, `/vision`, `/kiosk` per `src/middleware.ts`. Fourteen advisories accumulated since `14.2.35` was pinned in March 2026. `audit fix --force` proposes Next 16 which is a multi-major jump (Next 14 → 15 → 16, each with breaking changes — App Router behavior, caching defaults, React 19, etc.). Recommended: read https://nextjs.org/blog/next-14-2 patch notes, find the highest 14.2.x that addresses the most advisories without breaking changes, and bump there as Phase 1.

- **`lodash`**: The only flagged transitive on the runtime path. Arrives via `cloudinary@2.9.0 → lodash@4.17.23`. Cloudinary SDK uses lodash for utility functions, not user-input templating, so the `_.template` vector is unlikely exploitable through SDNV's usage. Prototype pollution via `_.unset`/`_.omit` is more concerning but again depends on what Cloudinary passes through. Worth fixing because it's free (non-breaking). After the fix, verify Cloudinary calls still work (sign-upload, asset list, etc.).

---

### 🟡 Bucket 2 — Acceptable risk, fix during regular upgrade cycle

| Package | Version | Severity | Path | Notes |
|---|---|---|---|---|
| `brace-expansion` | `<=1.1.12 \|\| 2.0.0–2.0.2 \|\| 4.0.0–5.0.5` | moderate | `eslint`, `eslint-config-next`, `@typescript-eslint/typescript-estree` (DEV) | Zero-step sequence DoS in glob expansion. Reachable only via crafted glob inputs at lint time. No runtime impact. |
| `flatted` | `<=3.4.1` | high | `eslint → file-entry-cache → flat-cache` (DEV) | DoS + prototype pollution in `parse()`. Reachable only via ESLint cache file contents — local/CI machines only. No runtime impact. |
| `fast-uri` | `<=3.1.1` | high | `prisma → @prisma/dev → @prisma/streams-local → ajv` (DEV) | Path traversal + host confusion in URI parsing. Used by Prisma Studio dev tooling. Not loaded by production. |
| `picomatch` | `<=2.3.1 \|\| 4.0.0–4.0.3` | high | `tailwindcss → chokidar` AND `eslint-config-next → tinyglobby` (BUILD/DEV) | POSIX char class injection + ReDoS in extglob. Tailwind uses it to scan source files for class names at build time. ReDoS requires attacker-controlled glob input, not a realistic vector. |
| `glob` | `10.2.0 – 10.4.5` | high | `eslint-config-next → @next/eslint-plugin-next → glob` (DEV) | Command injection via `-c`/`--cmd` **CLI flag** — library usage as a glob matcher is unaffected. SDNV doesn't invoke `glob` as a CLI. |
| `hono` + `@hono/node-server` | various | moderate | `prisma → @prisma/dev → @hono/node-server / hono` (DEV) | 11 hono advisories (cookie handling, path traversal, JSX injection, JWT validation, cache leakage). All in Prisma Studio's local web UI — not in production runtime. |
| `postcss` | `<8.5.10` | moderate | `next` (BUILD) | XSS via unescaped `</style>` in stringify output. Only matters if an attacker can inject CSS through the build pipeline. Fix via `npm audit fix --force` would jump `next` to 16 — defer until the Next upgrade in Bucket 1. |

**Common theme:** Almost all of these are in lint/dev/build-time chains. They're real CVEs but they're not exposed to production traffic. Batch them into the next scheduled dep-upgrade window (likely tied to the Next.js patch in Bucket 1, since the eslint-config-next and postcss chains will resolve naturally with Next).

---

### 🟢 Bucket 3 — Needs more investigation

| Item | Why it's here | What we'd need to decide |
|---|---|---|
| **Latest `next@14.2.x` patch** | The audit's "fix" proposal is `next@16.2.6` (breaking). We need to identify which `14.2.x` release covers the most of the 14 advisories without forcing a major-version jump. | Read Next.js 14.2 changelog (`14.2.36` → `14.2.40` or later); cross-reference against the 14 GHSA IDs in the audit output. Then `npm install next@<picked-version> eslint-config-next@<matching>`. |
| **`next-auth@5.0.0-beta.30`** | Not flagged by `npm audit`. But: it's a **beta dep on the critical auth path** (`src/lib/auth.ts`). Risk = silent breaking changes between beta releases, possible undisclosed vulnerabilities, no guarantee that GA will be backward compatible. | Track Auth.js v5 GA release; plan an upgrade test sprint when it ships. Read changelog between current beta.30 and latest beta to assess drift. |
| **`heic2any@0.0.4`** | Not flagged by `npm audit`. But: pre-1.0 (`0.0.x`), used client-side in `src/components/admin/AssetUploader.tsx:59-65` to convert iPhone HEIC to JPEG before Cloudinary upload. | Check last-commit date on the GitHub repo; if abandoned, evaluate alternatives. Lock the exact version (currently `^0.0.4` — bump to `0.0.4` exact if upstream is volatile). |
| **`react-masonry-css@1.0.16`** | Not flagged by `npm audit`. Last upstream activity: 2022. Used in the gallery layout (likely `src/components/gallery/*`). | Decide: keep until it breaks vs. swap for an actively-maintained alternative (e.g., `react-photo-album`, plain CSS columns, or a custom masonry implementation). Low urgency; no known security issue. |
| **Lodash post-fix verification** | After running `npm audit fix` for lodash, the resolved version still needs to work with Cloudinary's SDK. | Run the build, then smoke test admin Cloudinary upload flows (sign-upload, list-assets) after the fix. |

---

## Recommended next actions

1. **Run `npm audit fix`** (non-breaking). This will resolve `brace-expansion`, `flatted`, `fast-uri`, `picomatch`, `hono`, `lodash` — roughly half the findings. Verify build + lint + tsc remain green after.

2. **Sprint to bump `next` within the 14.2.x line.** Pick the latest patch release that addresses the most of the 14 Next advisories without crossing into 15. Update `eslint-config-next` in lockstep. Verify `/api/quote`, `/api/leads/[id]/upload`, image-optimized `/projects/[slug]` renders, and middleware-gated admin routes still work after.

3. **Plan a separate Next 14 → 15 → 16 migration sprint** as a strategic item (next 1–3 months). Touch points: App Router caching semantics, React 19, the `cookies()` / `headers()` async migration in 15. Out of scope for an audit-driven sprint.

4. **Track `next-auth` v5 GA release.** When it ships, run an isolated upgrade test in a feature branch. Auth changes are notoriously easy to silently break.

5. **Defer `heic2any` and `react-masonry-css` decisions** until they actually break or a clear alternative emerges. No security urgency on either.

6. **Do NOT run `npm audit fix --force`** without a planned upgrade sprint. It would push `next` to 16 and `eslint-config-next` to 16 in one shot, which is at least three major versions of breaking changes.

---

## Raw `npm audit` output

```
# npm audit report

@hono/node-server  <1.19.13
Severity: moderate
@hono/node-server: Middleware bypass via repeated slashes in serveStatic - https://github.com/advisories/GHSA-92pp-h63x-v22m
fix available via `npm audit fix --force`
Will install prisma@6.19.3, which is a breaking change
node_modules/@hono/node-server
  @prisma/dev  *
  Depends on vulnerable versions of @hono/node-server
  node_modules/@prisma/dev
    prisma  >=6.20.0-dev.1
    Depends on vulnerable versions of @prisma/dev
    node_modules/prisma

brace-expansion  <=1.1.12 || 2.0.0 - 2.0.2 || 4.0.0 - 5.0.5
Severity: moderate
brace-expansion: Zero-step sequence causes process hang and memory exhaustion - https://github.com/advisories/GHSA-f886-m6hf-6m8v
brace-expansion: Zero-step sequence causes process hang and memory exhaustion - https://github.com/advisories/GHSA-f886-m6hf-6m8v
brace-expansion: Zero-step sequence causes process hang and memory exhaustion - https://github.com/advisories/GHSA-f886-m6hf-6m8v
brace-expansion: Large numeric range defeats documented `max` DoS protection - https://github.com/advisories/GHSA-jxxr-4gwj-5jf2
fix available via `npm audit fix`
node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion
node_modules/brace-expansion
node_modules/glob/node_modules/brace-expansion

fast-uri  <=3.1.1
Severity: high
fast-uri vulnerable to path traversal via percent-encoded dot segments - https://github.com/advisories/GHSA-q3j6-qgpj-74h6
fast-uri vulnerable to host confusion via percent-encoded authority delimiters - https://github.com/advisories/GHSA-v39h-62p7-jpjc
fix available via `npm audit fix`
node_modules/fast-uri

flatted  <=3.4.1
Severity: high
flatted vulnerable to unbounded recursion DoS in parse() revive phase - https://github.com/advisories/GHSA-25h7-pfq9-p65f
Prototype Pollution via parse() in NodeJS flatted - https://github.com/advisories/GHSA-rf6f-7fwh-wjgh
fix available via `npm audit fix`
node_modules/flatted

glob  10.2.0 - 10.4.5
Severity: high
glob CLI: Command injection via -c/--cmd executes matches with shell:true - https://github.com/advisories/GHSA-5j98-mcp5-4vw2
fix available via `npm audit fix --force`
Will install eslint-config-next@16.2.6, which is a breaking change
node_modules/glob
  @next/eslint-plugin-next  14.0.5-canary.0 - 15.0.0-rc.1
  Depends on vulnerable versions of @next/eslint-plugin-next
  node_modules/@next/eslint-plugin-next
    eslint-config-next  14.0.5-canary.0 - 15.0.0-rc.1
    Depends on vulnerable versions of @next/eslint-plugin-next
    node_modules/eslint-config-next

hono  <=4.12.17
Severity: moderate
Hono missing validation of cookie name on write path in setCookie() - https://github.com/advisories/GHSA-26pp-8wgv-hjvm
Hono: Non-breaking space prefix bypass in cookie name handling in getCookie() - https://github.com/advisories/GHSA-r5rp-j6wh-rvv4
Hono: Path traversal in toSSG() allows writing files outside the output directory - https://github.com/advisories/GHSA-xf4j-xp2r-rqqx
Hono: Middleware bypass via repeated slashes in serveStatic - https://github.com/advisories/GHSA-wmmm-f939-6g9c
hono Improperly Handles JSX Attribute Names Allows HTML Injection in hono/jsx SSR - https://github.com/advisories/GHSA-458j-xx4x-4375
Hono has incorrect IP matching in ipRestriction() for IPv4-mapped IPv6 addresses - https://github.com/advisories/GHSA-xpcf-pg52-r92g
Hono has CSS Declaration Injection via Style Object Values in JSX SSR - https://github.com/advisories/GHSA-qp7p-654g-cw7p
Hono has improper validation of NumericDate claims (exp, nbf, iat) in JWT verify() - https://github.com/advisories/GHSA-hm8q-7f3q-5f36
Hono's Cache Middleware ignores Vary: Authorization / Vary: Cookie leading to cross-user cache leakage - https://github.com/advisories/GHSA-p77w-8qqv-26rm
Hono: bodyLimit() can be bypassed for chunked / unknown-length requests - https://github.com/advisories/GHSA-9vqf-7f2p-gf9v
hono/jsx has Unvalidated JSX Tag Names that May Allow HTML Injection - https://github.com/advisories/GHSA-69xw-7hcm-h432
fix available via `npm audit fix`
node_modules/hono

lodash  <=4.17.23
Severity: high
lodash vulnerable to Code Injection via `_.template` imports key names - https://github.com/advisories/GHSA-r5fr-rjxr-66jc
lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit` - https://github.com/advisories/GHSA-f23m-r3pf-42rh
fix available via `npm audit fix`
node_modules/lodash

next  9.3.4-canary.0 - 16.3.0-canary.5
Severity: high
Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns configuration - https://github.com/advisories/GHSA-9g9p-9gw9-jx7f
Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components - https://github.com/advisories/GHSA-h25m-26qc-wcjf
Next.js: HTTP request smuggling in rewrites - https://github.com/advisories/GHSA-ggv3-7p47-pfv8
Next.js: Unbounded next/image disk cache growth can exhaust storage - https://github.com/advisories/GHSA-3x4c-7xq6-9pq8
Next.js has a Denial of Service with Server Components - https://github.com/advisories/GHSA-q4gf-8mx6-v5v3
Next.js Vulnerable to Denial of Service with Server Components - https://github.com/advisories/GHSA-8h8q-6873-q5fj
Next.js's Middleware / Proxy redirects can be cache-poisoned - https://github.com/advisories/GHSA-3g8h-86w9-wvmq
Next.js vulnerable to cross-site scripting in App Router applications using CSP nonces - https://github.com/advisories/GHSA-ffhc-5mcf-pf4q
Next.js vulnerable to cache poisoning via collisions in React Server Component cache-busting - https://github.com/advisories/GHSA-vfv6-92ff-j949
Next.js has cross-site scripting in beforeInteractive scripts with untrusted input - https://github.com/advisories/GHSA-gx5p-jg67-6x7h
Next.js has a Denial of Service in the Image Optimization API - https://github.com/advisories/GHSA-h64f-5h5j-jqjh
Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades - https://github.com/advisories/GHSA-c4j6-fc7j-m34r
Next.js vulnerable to cache poisoning in React Server Component responses - https://github.com/advisories/GHSA-wfc6-r584-vfw7
Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n - https://github.com/advisories/GHSA-36qx-fr4f-26g5
Depends on vulnerable versions of postcss
fix available via `npm audit fix --force`
Will install next@16.2.6, which is a breaking change
node_modules/next

picomatch  <=2.3.1 || 4.0.0 - 4.0.3
Severity: high
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
fix available via `npm audit fix`
node_modules/picomatch
node_modules/tinyglobby/node_modules/picomatch

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix --force`
Will install next@16.2.6, which is a breaking change
node_modules/next/node_modules/postcss
node_modules/postcss

14 vulnerabilities (6 moderate, 8 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```
