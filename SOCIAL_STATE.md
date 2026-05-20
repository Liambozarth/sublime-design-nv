# SDNV Social Media Integration State

**Date:** 2026-05-19
**Commit at investigation:** `7ccd8fa`
**One-line headline:** Admin UI works in copy-caption fallback mode; auto-post pipeline has real code on all four platforms but is gated by a tangle of credential, OAuth-vs-env, and orchestration gaps — the most damaging of which is that **no Vercel cron is configured**, so scheduled posts will never publish automatically even with perfect credentials.

---

## Executive summary

There is real, non-stub code for posting to **Instagram, Facebook, and Pinterest** via their official APIs, plus a scheduled-posts model, a cron worker, an OAuth flow for Meta, and an admin UI that gracefully degrades to copy-caption mode when credentials are absent. However, several problems compound:

1. **The cron worker exists but no Vercel cron schedule is configured** (no `vercel.json` at all). Scheduled posts sit at `status:"pending"` forever unless the cron URL is hit manually.
2. **There are two parallel posting code paths** for Meta — an OAuth-stored-token path and a system-user-token path — and they don't share credentials. The OAuth callback writes a token to the DB that nothing else reads.
3. **Pinterest has API code that reads its token from the DB**, but **no OAuth callback route exists to populate that DB row**. The Pinterest token would have to be manually inserted into `SocialAccount` to make the existing posting code work.
4. **The cron worker only handles Instagram and Facebook**; scheduled Pinterest posts never get processed.
5. **The analytics endpoint is a stub** — returns hardcoded `null` for follower/reach/impression counts.

So the platform is closer to "fully built" than the audit suggested — but the seams between components are misaligned in ways that need 1–2 small fix sprints, not a build sprint, before anything would post.

---

## Inventory by platform

### Instagram

- **Status:** 🟡 **Wired but credential-gated** (with the caveat that two parallel paths exist; see Meta section)
- **Files involved:**
  - [src/app/admin/social/page.tsx](src/app/admin/social/page.tsx) — admin UI for compose/schedule
  - [src/app/api/admin/social/post-instagram/route.ts](src/app/api/admin/social/post-instagram/route.ts) — direct one-off post (uses `META_*` env vars)
  - [src/app/api/admin/social/publish/route.ts](src/app/api/admin/social/publish/route.ts) — publishes a scheduled-post row via `meta.ts`
  - [src/app/api/admin/social/auth/instagram/route.ts](src/app/api/admin/social/auth/instagram/route.ts) + `/callback/route.ts` — Facebook-OAuth-as-Instagram-auth flow (IG Business accounts are connected through FB Pages)
  - [src/lib/social/meta.ts](src/lib/social/meta.ts) — Graph v19 helpers (`createInstagramContainer`, `publishInstagramContainer`, `publishInstagramCarousel`)
- **Admin UI:** [src/app/admin/social/page.tsx:423,443](src/app/admin/social/page.tsx#L423) switches button label between "Post to Instagram" (when `NEXT_PUBLIC_META_CONFIGURED === "true"`) and "Copy for Instagram" otherwise. The "Post" branch calls `/api/admin/social/post-instagram`.
- **API path:** Two paths exist; see Meta App section.
- **Data model:** [`ScheduledPost`](prisma/schema.prisma#L150-L175) (`platform`, `caption`, `hashtags`, `mediaAssetIds[]`, `scheduledFor`, `status`, `postedAt`, `postId`, `errorMessage`).
- **Env vars required:** `META_SYSTEM_USER_TOKEN` + `META_INSTAGRAM_ACCOUNT_ID` (for the post-instagram route) OR `INSTAGRAM_ACCOUNT_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` (for the publish route + cron via meta.ts).
- **Current behavior:** With no env vars set, the admin UI falls back to copy-caption (works for Tyler to paste manually). With env vars, real Graph API calls fire — creates a media container then publishes it; carousel logic exists for multi-image posts.
- **Blockers:**
  - Meta App needs to be reviewed/approved for production `instagram_content_publish` scope.
  - Instagram account must be Business or Creator and linked to a Facebook Page.
  - Long-lived token must be generated and pasted into Vercel env.
- **Notes:** Carousel branch ([meta.ts:33-59](src/lib/social/meta.ts#L33-L59)) handles >1 image cleanly. Container/publish error states throw with the Graph API message attached.

### Facebook

- **Status:** 🟡 **Wired but credential-gated**
- **Files involved:**
  - [src/app/api/admin/social/post-facebook/route.ts](src/app/api/admin/social/post-facebook/route.ts) — direct post
  - [src/app/api/admin/social/publish/route.ts](src/app/api/admin/social/publish/route.ts) — scheduled-post publisher
  - [src/app/api/admin/social/auth/facebook/route.ts](src/app/api/admin/social/auth/facebook/route.ts) + `/callback/route.ts` — OAuth
  - [src/lib/social/meta.ts:61-69](src/lib/social/meta.ts#L61-L69) — `postToFacebook(message, imageUrl?)`
- **Admin UI:** Same UI as Instagram — toggle between "Post to Facebook" and "Copy for Facebook" based on `NEXT_PUBLIC_META_CONFIGURED`.
- **API path:** `POST https://graph.facebook.com/v19.0/{pageId}/photos` (with image) or `/feed` (text only).
- **Data model:** Same `ScheduledPost`.
- **Env vars required:** `META_SYSTEM_USER_TOKEN` + `META_FACEBOOK_PAGE_ID` (direct path) or `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` (meta.ts/cron path).
- **Current behavior:** Same fallback pattern as Instagram. Posts to a single Page identified by env var.
- **Blockers:** Page access token must have `pages_manage_posts` + `publish_video` scopes. Token expires unless extended to long-lived (60-day) — needs renewal cadence or System User token.
- **Notes:** `postToFacebook` works for both photo and text-only posts based on whether `imageUrl` is passed.

### Meta App (shared FB/IG credential layer)

- **Status:** 🟠 **External-blocked + 🔴 wiring conflict between two parallel code paths**
- **Files involved:** Both meta-related auth callbacks; both direct-post routes; `meta.ts`; the `cron/social/route.ts` consumer.
- **What's going on:** There are **two posting code paths**, each with its own credential model:
  - **Path A (env-var system token):** `/api/admin/social/post-instagram` and `/post-facebook` read `META_SYSTEM_USER_TOKEN` + `META_INSTAGRAM_ACCOUNT_ID` + `META_FACEBOOK_PAGE_ID` directly from `process.env`. Gated client-side by `NEXT_PUBLIC_META_CONFIGURED`. These routes duplicate the Graph API logic inline (don't import `meta.ts`).
  - **Path B (env-var page token + lib helpers):** `/api/admin/social/publish` and the cron worker import from `meta.ts`, which reads `INSTAGRAM_ACCOUNT_ID` + `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` from `process.env`. Different env var names; same `process.env` source.
  - **Path C (intended but dead):** The OAuth callback at [`/auth/facebook/callback/route.ts`](src/app/api/admin/social/auth/facebook/callback/route.ts) and [`/auth/instagram/callback/route.ts`](src/app/api/admin/social/auth/instagram/callback/route.ts) exchange the OAuth code for a token and **write it to `SocialAccount.accessToken` in the DB**. Nothing in the entire codebase reads `socialAccount.accessToken` for Meta — only Pinterest's lib does. So the OAuth flow completes successfully and the stored token is then orphaned.
- **Implications:**
  - OAuth-stored Meta tokens are dead code. The OAuth UX is a misleading UI affordance — admin connects "Facebook" expecting that to enable posting, but `meta.ts` still requires a static `FACEBOOK_PAGE_ACCESS_TOKEN` env var that has to be set manually in Vercel.
  - To make Meta posting work today, you must EITHER set `FACEBOOK_PAGE_ACCESS_TOKEN` etc. (path B) OR set `META_SYSTEM_USER_TOKEN` etc. (path A). OAuth alone is insufficient.
- **Blockers:**
  - External: Meta App needs publishing-scope approval (see Instagram).
  - Internal: pick a credential pattern — either rewrite `meta.ts` to read from DB (matching Pinterest's pattern, making OAuth functional) or delete the OAuth callback routes (they're misleading).

### Pinterest

- **Status:** 🟡 **Wired but credential-gated + 🔴 missing OAuth flow + cron doesn't process it**
- **Files involved:**
  - [src/app/admin/social/pinterest/page.tsx](src/app/admin/social/pinterest/page.tsx) — Pinterest admin sub-page (boards UI)
  - [src/app/api/admin/social/pinterest/boards/route.ts](src/app/api/admin/social/pinterest/boards/route.ts) — list/sync/create boards
  - [src/app/api/admin/social/pinterest/boards/[boardId]/route.ts](src/app/api/admin/social/pinterest/boards/[boardId]/route.ts)
  - [src/app/api/admin/social/accounts/pinterest/route.ts](src/app/api/admin/social/accounts/pinterest/route.ts) — DELETE/disconnect only (no connect handler)
  - [src/lib/social/pinterest.ts](src/lib/social/pinterest.ts) — API v5 helpers (`getPinterestBoards`, `createPinterestBoard`, `createPin`, `syncPinterestBoards`)
  - [src/lib/social/pinterestUtils.ts](src/lib/social/pinterestUtils.ts) — `getDefaultBoardForProject` (resolves service/area → board)
- **Admin UI:** Boards-management page exists. Compose UI on main `/admin/social` page captures `boardId`, `pinTitle`, `pinUrl`, `altText` ([ScheduledPost has Pinterest-specific fields](prisma/schema.prisma#L163-L168)).
- **API path:** `POST https://api.pinterest.com/v5/pins` (and `/boards`, `/boards?page_size=100`).
- **Data model:** `ScheduledPost` (with Pinterest-specific fields) + [`PinterestBoard`](prisma/schema.prisma#L266-L279) (mirror of remote boards, with `serviceType` / `area` / `isDefault` mapping).
- **Env vars required:** `PINTEREST_APP_ID` + `PINTEREST_APP_SECRET` (gates `SOCIAL_ENABLED.pinterest`). Actual posting needs an access token stored in `SocialAccount.accessToken` for `platform="pinterest"`.
- **Current behavior:** `assertSocialEnabled("pinterest")` throws if env vars missing. If env vars set, `getAccessToken()` ([pinterest.ts:6-13](src/lib/social/pinterest.ts#L6-L13)) reads the token from DB; if no token row, throws *"Pinterest not connected. Go to Social → Settings to connect."*
- **Blockers:**
  - **No Pinterest OAuth callback route exists.** There's a disconnect handler (`/accounts/pinterest` DELETE) but no `/auth/pinterest` or `/auth/pinterest/callback`. The "Go to Social → Settings to connect" instruction in the error message points to nothing. The token has to be hand-inserted into `SocialAccount.accessToken` via DB to make any of the wired code work.
  - **The cron worker doesn't handle Pinterest** ([cron/social/route.ts:45](src/app/api/cron/social/route.ts#L45)) — `platform` is typed as `"instagram" | "facebook" | "both"`. Scheduled Pinterest posts would sit pending forever (or fail the platform-skip check).
  - External: Pinterest API access is currently in good standing (assumes the account-claim issue Brandon mentioned is separate).
- **Notes:** `pinterestUtils.getDefaultBoardForProject` is the smart mapping — given a project's serviceSlug/areaSlug, picks a board. Solid logic, just unreachable until token is in DB.

### YouTube

- **Status:** ⚫ **Disconnect handler only — no posting code**
- **Files involved:**
  - [src/lib/google/youtube.ts](src/lib/google/youtube.ts) — `fetchYouTubeChannel` helper (read-only, lists channels)
  - [src/app/api/admin/social/accounts/youtube/route.ts](src/app/api/admin/social/accounts/youtube/route.ts) — DELETE (disconnect) only
- **Env vars required:** `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` in `.env.example`, but the OAuth flow + posting code aren't implemented.
- **Notes:** `ScheduledPost` has YouTube-shaped fields (`title`, `description`, `visibility`) ([schema.prisma:170-172](prisma/schema.prisma#L170-L172)) suggesting the intent was there, but no upload helper, no callback, no cron branch.

### TikTok

- **Status:** ⚫ **Missing entirely** — no env vars, no code, no model field.

### Yelp

- **Status:** ⚫ **Missing entirely** — no code, no env vars, no schema fields. Listed in the audit as a future widget/CTA opportunity but nothing implemented.

---

## Scheduling and cron

- **Cron route:** [src/app/api/cron/social/route.ts](src/app/api/cron/social/route.ts) — GET handler.
- **Schedule:** **None configured.** There is no `vercel.json` in the repo. The cron route exists and is functional, but **nothing on Vercel is calling it on a schedule**. Without a `vercel.json` `crons` entry (or some external scheduler hitting the URL), scheduled posts stay at `status:"pending"` indefinitely.
- **Auth:** `CRON_SECRET` Bearer-token-gated ([line 14-19](src/app/api/cron/social/route.ts#L14-L19)) — solid, matches Sprint 1's hardening.
- **What it does:** Picks up to 20 posts where `status="pending"` and `scheduledFor <= now` (or `scheduledFor IS NULL`). For each, resolves `mediaAssetIds` to secure URLs, calls `createInstagramContainer`/`publishInstagramContainer` (or carousel) and/or `postToFacebook` via `meta.ts`. On success: marks `posted`, stores `postId`. On failure: marks `failed` with `errorMessage`.
- **Failure handling:** **No retry.** Once a post is `failed`, it stays failed; the where-clause only re-picks `pending`. There's no exponential backoff, no dead-letter table, no admin "retry" handler exposed.
- **Pinterest handling:** **None.** The platform discriminator is `"instagram" | "facebook" | "both"`; Pinterest posts aren't matched, so they remain pending forever even if the cron is scheduled.
- **Status:** 🔴 **Critically incomplete** — code is good, but unscheduled (won't auto-run) and Pinterest-blind.

---

## Env var matrix

| Variable | Purpose | In `.env.example` | Used by | External setup needed |
|---|---|---|---|---|
| `FACEBOOK_APP_ID` | Meta App ID (OAuth init) | ✅ | OAuth init/callback (FB + IG) | Create Meta App at developers.facebook.com |
| `FACEBOOK_APP_SECRET` | Meta App Secret (OAuth code exchange) | ✅ | OAuth callbacks | Same Meta App |
| `FACEBOOK_PAGE_ID` | Page ID for FB posting | ✅ | `meta.ts:postToFacebook`, cron | Get from FB Page settings |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Page Access Token | ✅ | `meta.ts` (all IG + FB posting via path B) | Generated per FB Page; needs `pages_manage_posts` scope |
| `INSTAGRAM_ACCOUNT_ID` | IG Business Account ID | ✅ | `meta.ts` (path B) | IG must be Business/Creator linked to FB Page |
| `META_SYSTEM_USER_TOKEN` | Long-lived System User token | ✅ | `post-instagram`, `post-facebook` (path A) | Meta App approved + System User created + token generated |
| `META_INSTAGRAM_ACCOUNT_ID` | (duplicates `INSTAGRAM_ACCOUNT_ID` for path A) | ✅ | `post-instagram` | Same as INSTAGRAM_ACCOUNT_ID |
| `META_FACEBOOK_PAGE_ID` | (duplicates `FACEBOOK_PAGE_ID` for path A) | ✅ | `post-facebook` | Same as FACEBOOK_PAGE_ID |
| `NEXT_PUBLIC_META_CONFIGURED` | Client-side gate ("true" → show Post buttons) | ✅ | `admin/social/page.tsx:409,423,429,443,775` | Set to `"true"` once tokens are populated |
| `PINTEREST_APP_ID` | Pinterest App ID | ✅ | `SOCIAL_ENABLED.pinterest` check | Create Pinterest App; resolve account-claim issue if any |
| `PINTEREST_APP_SECRET` | Pinterest App Secret | ✅ | `SOCIAL_ENABLED.pinterest` check | Same Pinterest App |
| Pinterest access token | OAuth-granted token | n/a | `pinterest.ts:getAccessToken()` from DB | **No OAuth flow exists — must hand-insert into `SocialAccount` row** |
| `YOUTUBE_CLIENT_ID` | YouTube OAuth | ✅ | (none — not wired) | Google Cloud Console OAuth client |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth | ✅ | (none — not wired) | Same |
| `CRON_SECRET` | Cron route auth | ✅ | `cron/social/route.ts`, other crons | Generate random string; set in Vercel |
| `NEXT_PUBLIC_SITE_URL` | OAuth redirect URI | (different name in `.env.example`: `NEXT_PUBLIC_SITE_URL`) | All OAuth init/callback routes | Set to live site URL |

---

## Gap analysis

### 🔴 Code-side gaps (need a build sprint)

1. **No Vercel cron schedule configured.** No `vercel.json` exists; the cron worker is dead-code without a scheduler. Single highest-impact fix: add a `vercel.json` with a `crons` entry hitting `/api/cron/social` every 5–15 minutes.
2. **Cron worker is Pinterest-blind.** The `platform` discriminator at [cron/social/route.ts:45](src/app/api/cron/social/route.ts#L45) only handles IG/FB/both. Pinterest scheduled posts never publish. Add a Pinterest branch that calls `createPin` from `pinterest.ts`.
3. **OAuth-stored Meta tokens are dead.** The FB and IG OAuth callbacks write `accessToken` to `SocialAccount` but `meta.ts` reads from `process.env`. Either:
   - Rewrite `meta.ts` to read tokens from DB (matching Pinterest's pattern), making OAuth meaningful, OR
   - Delete the OAuth callback routes and the corresponding UI buttons (less work, simpler mental model — admin just sets env vars).
4. **No Pinterest OAuth flow exists.** The error message in `pinterest.ts:11` points users to "Social → Settings to connect" but no `/api/admin/social/auth/pinterest` route exists. Either build it or document that Pinterest tokens are admin-paste-into-DB-only.
5. **Analytics endpoint is a stub.** [`/api/admin/social/analytics`](src/app/api/admin/social/analytics/route.ts) returns hardcoded `null` for follower/reach/impression counts. Would need real Graph API + Pinterest API calls to populate.
6. **No cron retry logic.** Failed posts stay failed; no admin "retry" UI affordance.

### 🟠 External-blocked (need real-world setup, not code)

1. **Meta App publishing-scope approval.** `instagram_content_publish` + `pages_manage_posts` need to come out of dev mode via Meta App Review. This is the slowest external dependency (multi-week submission process).
2. **Long-lived System User token generation** (path A) — needs the Meta App approved first, then in the Business Manager System User flow.
3. **Pinterest API access standing** — Brandon mentioned a Pinterest account-claim issue at some point; need to confirm current standing.
4. **Tyler's social accounts as Business/Creator (IG)** — IG must be a Business or Creator account linked to a FB Page for `instagram_content_publish` to apply.

### 🟡 Credential-gated (would work once env vars are filled)

1. **Instagram + Facebook posting via path B** (`meta.ts` route) — works the moment `FACEBOOK_PAGE_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID` + `INSTAGRAM_ACCOUNT_ID` are in Vercel.
2. **Instagram + Facebook posting via path A** (`post-instagram` / `post-facebook` routes) — works once `META_SYSTEM_USER_TOKEN` + `META_*_ID` are set.
3. **Pinterest read operations** (list boards, sync boards) — works once `PINTEREST_APP_ID/SECRET` are set AND a token is in the DB.
4. **Admin UI "Copy" mode** — works today without any env vars (already in production-fallback state).

### 🟢 Already working

1. **Caption generation** — [generateSocialCaption.ts](src/lib/generateSocialCaption.ts) produces captions deterministically from project metadata; no API dependency.
2. **Scheduled-post creation + cancel + listing** — DB-only, fully wired.
3. **Board → project mapping logic** — `pinterestUtils.getDefaultBoardForProject` is solid.
4. **Admin compose UI** — `/admin/social` page renders, lets Tyler compose, and saves to `ScheduledPost`. Posts queue successfully even with no credentials (queued status).
5. **Site-health page** ([admin/site-health:427-431](src/app/admin/site-health/page.tsx#L427-L431)) flags missing FB credentials to the admin — good observability.

---

## Recommended next-step sequence

Ordered by **highest value per smallest cost first**:

1. **Sprint X — Add the cron schedule (½ day).**
   - Create `vercel.json` with a `crons` entry: `{"path": "/api/cron/social", "schedule": "*/15 * * * *"}` (every 15 minutes is the Vercel-friendly minimum).
   - Without this, every other social fix is moot. This is the cheapest single change that turns "queued posts" into "actually published posts" once credentials are set.
   - Side effect: also brings online any other cron routes that exist (check `src/app/api/cron/` for siblings; only `social` exists today).

2. **Sprint Y — Add the Pinterest cron branch (½ day).**
   - Extend `cron/social/route.ts` to handle `platform === "pinterest"`. Call `createPin` from `pinterest.ts`. Use `pinterestUtils.getDefaultBoardForProject` to default the board if `boardId` is null. Mirror the IG/FB error handling.
   - Requires Sprint X to be useful but doesn't depend on it being complete.

3. **Sprint Z — Resolve the Meta credential conflict (1 day).**
   - **Decision:** option A — delete the OAuth callback routes and the "Connect Facebook" / "Connect Instagram" UI buttons, since `meta.ts` doesn't use the stored tokens. Lean on env vars. Simplest mental model.
   - **Alternative:** option B — rewrite `meta.ts` to read tokens from `SocialAccount` (matching `pinterest.ts`). Makes OAuth functional and lets admin connect via UI. More work but better UX long-term.
   - Recommend option A unless Brandon explicitly wants the OAuth flow live.

4. **Sprint W — Add a Pinterest OAuth flow (1 day) — only if Sprint Z chose option B-style architecture.**
   - Build `/api/admin/social/auth/pinterest/route.ts` + `/callback/route.ts` mirroring the Meta pattern.
   - Otherwise, document that Pinterest tokens are env-var or manual-DB-insert only.

5. **Sprint V — Add cron retry + admin retry button (1 day).**
   - Add `retryCount` + `nextRetryAt` to `ScheduledPost`. Cron picks up `failed` posts with `nextRetryAt <= now` AND `retryCount < 3`. Exponential backoff. Optional but useful.

6. **Sprint U — Real analytics (multi-day).**
   - Wire `/api/admin/social/analytics` to actually call Graph API insights endpoints + Pinterest analytics. Higher cost; defer until #1–4 are done.

---

## Open questions for Brandon / Tyler

1. **Has the Meta App been submitted for App Review?** If not, none of the Meta-posting code will work in production regardless of env-var state.
2. **Is Tyler's Instagram a Business or Creator account, and linked to the Facebook Page?** Required for `instagram_content_publish`.
3. **Is the Pinterest API account in good standing?** I see scaffolding suggesting there was an account-claim issue at some point — need to confirm current state before recommending Pinterest work.
4. **Which Meta credential path does Brandon want kept?** Path A (env-var system token) is simpler and the admin UI already gates on `NEXT_PUBLIC_META_CONFIGURED` for it. Path B (env-var page token via meta.ts) is what the cron worker uses. Picking one and removing the other would simplify the codebase significantly.
5. **Was the OAuth flow ever intended to be the real auth mechanism?** If yes, `meta.ts` needs a rewrite to read tokens from DB. If no, the OAuth routes should be deleted to stop confusing future Claude (and Brandon).
6. **Was a Vercel cron ever set up via the Vercel dashboard instead of `vercel.json`?** Recent Vercel versions support cron configuration through the dashboard or vercel.json — I can only see the repo, not the deployment config. Worth checking the Vercel project's "Cron Jobs" tab to verify nothing is firing today.
7. **YouTube and TikTok scaffolding** — were these started intentionally and shelved, or accidentally? `ScheduledPost` has YouTube fields suggesting real intent; do we want to revive that or strip them?
