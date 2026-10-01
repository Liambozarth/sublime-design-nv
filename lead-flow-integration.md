# Lead Flow Integration — Sublime Design NV
## Spec for Claude Code

---

## Overview

Build a full lead intake and AI vision system for Sublime Design NV. The goal: a client gets off the phone, receives a link, completes a rich intake experience on their phone or desktop, and walks away with an AI-generated visual concept of their project — so they know exactly what they want before a bid is ever written.

This eliminates the "I'll know it when I see it" problem and creates a paper trail of agreed-upon vision from day one.

---

## System Architecture

```
/app
  /intake                  ← Public-facing client intake form
    /[token]               ← Unique link per lead (pre-populated with name/phone)
  /vision                  ← AI concept generation result page (client-facing)
    /[leadId]
  /dashboard               ← Internal contractor view
    /leads
    /leads/[leadId]
  /api
    /leads                 ← POST create lead, GET list
    /leads/[id]            ← GET single, PATCH update
    /leads/[id]/upload     ← POST media uploads → Cloudinary
    /leads/[id]/generate   ← POST trigger AI vision generation
    /intake/send           ← POST send intake link via SMS/email
```

---

## Database Schema (Prisma)

Add to existing schema:

```prisma
model Lead {
  id            String        @id @default(cuid())
  token         String        @unique @default(cuid()) // public intake URL token
  
  // Contact
  firstName     String
  lastName      String?
  phone         String?
  email         String?
  
  // Project
  serviceType   ServiceType
  projectNotes  String?       // freeform notes from contractor before sending link
  
  // Intake responses (filled by client)
  intakeData    Json?         // structured answers from intake form
  
  // Media
  assets        LeadAsset[]
  
  // AI Vision
  visionPrompt  String?       // assembled prompt sent to AI
  visionResult  Json?         // AI response (description, mood board data, etc.)
  visionStatus  VisionStatus  @default(PENDING)
  
  // Status
  status        LeadStatus    @default(NEW)
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model LeadAsset {
  id            String        @id @default(cuid())
  leadId        String
  lead          Lead          @relation(fields: [leadId], references: [id])
  
  type          AssetType     // SPACE_PHOTO | INSPIRATION_PHOTO | VIDEO | LINK | PRODUCT_LINK
  url           String        // Cloudinary URL or external URL
  cloudinaryId  String?
  caption       String?       // client-provided label
  
  createdAt     DateTime      @default(now())
}

enum ServiceType {
  BARN_DOORS
  CABINETS
  CUSTOM_CLOSETS
  FAUX_BEAMS
  FLOATING_SHELVES
  MANTELS
  TRIM_WORK
  MULTIPLE
  OTHER
}

enum AssetType {
  SPACE_PHOTO
  INSPIRATION_PHOTO
  VIDEO
  PRODUCT_LINK
  INSPIRATION_LINK
}

enum LeadStatus {
  NEW
  INTAKE_SENT
  INTAKE_STARTED
  INTAKE_COMPLETE
  VISION_GENERATED
  BID_READY
  CONVERTED
  CLOSED
}

enum VisionStatus {
  PENDING
  GENERATING
  COMPLETE
  FAILED
}
```

Run migration after schema update:
```bash
npx prisma migrate dev --name add_lead_flow
```

---

## Phase 1 — Send Intake Link (Contractor Action)

### UI: `/dashboard/leads/new`

Simple form the contractor fills out immediately after hanging up:

**Fields:**
- First Name (required)
- Last Name
- Phone or Email (at least one required)
- Service Type (dropdown — matches `ServiceType` enum)
- Quick Notes (anything discussed on the call — pre-populates AI context)

**Submit action:**
1. Creates `Lead` record with unique `token`
2. Sends intake link via SMS (Twilio) or email (Resend) — contractor chooses
3. Link format: `https://sublimedesignnv.com/intake/[token]`

### API: `POST /api/intake/send`

```ts
// Request body
{
  firstName: string
  lastName?: string
  phone?: string
  email?: string
  serviceType: ServiceType
  projectNotes?: string
  sendVia: 'sms' | 'email'
}

// Response
{
  leadId: string
  token: string
  intakeUrl: string
}
```

**SMS via Twilio** (add env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`):
```
Message: "Hi [firstName]! Tyler at Sublime Design NV here. Tap the link below to share your project details and inspiration — we'll use it to show you a visual concept before we ever start measuring. Takes about 5 minutes. [link]"
```

**Email via Resend** (existing integration):
- Subject: "Your Sublime Design Project — Share Your Vision"
- Branded email template with CTA button

---

## Phase 2 — Client Intake Experience

### Route: `/intake/[token]`

**Design requirements:**
- Mobile-first, full-screen step-by-step flow (not a wall of fields)
- Sublime Design brand: patriot red `#CC2027`, navy `#1B2A6B`, white
- Step indicator showing progress (e.g., Step 2 of 5)
- Each step = one focused task
- Feels premium, not like a Google Form

### Step Flow

**Step 1 — Welcome**
- "Hi [firstName], let's bring your vision to life."
- Brief explanation: "We're going to ask a few questions, then have you share photos and inspiration. At the end, we'll show you an AI concept of your project."
- CTA: "Let's Go"

**Step 2 — Project Basics** (dynamic per service type, pre-selected from contractor input)

Base questions (all services):
- "What's the space we're working in?" (dropdown: Kitchen, Living Room, Master Bedroom, Dining Room, Office, Garage, Other)
- "How would you describe your style?" (multi-select chips: Modern, Rustic, Industrial, Traditional, Farmhouse, Transitional, Custom/Not Sure)
- "Do you have a budget range in mind?" (optional, range slider: $500 – $20,000+)
- "When are you hoping to have this done?" (dropdown: ASAP, 1–3 months, 3–6 months, No rush)

Service-specific questions:

*BARN_DOORS:*
- Single or double door?
- Bypass (slides past) or standard slide?
- Approximate opening size (W x H in feet) — "rough estimate is fine"
- Hardware finish preference (Black, Brushed Nickel, Bronze, Not Sure)

*CABINETS:*
- New build or refacing existing?
- Upper, lower, or both?
- Approximate linear feet of cabinetry
- Door style preference (Shaker, Flat panel, Raised panel, Open shelving, Not Sure)

*CUSTOM_CLOSETS:*
- Walk-in or reach-in?
- Hanging space priority, drawer space priority, or balanced?
- Any special storage needs? (shoes, accessories, safe, etc.)

*FAUX_BEAMS:*
- Ceiling height (approx)?
- How many beams? (rough count or "not sure")
- Beam orientation (parallel runs, grid/coffers, single accent beam)

*FLOATING_SHELVES:*
- How many shelves?
- Approximate length per shelf
- Decorative or functional storage use?

*MANTELS:*
- Existing fireplace or new build?
- Gas, wood-burning, or electric insert?
- Surround included or mantel shelf only?

*TRIM_WORK:*
- Type needed (multi-select: Crown molding, Baseboard, Casing, Wainscoting, Board & batten, Coffered ceiling, Other)
- Approximate square footage of space

**Step 3 — Photos of Your Space**

- "Show us what we're working with."
- Subtext: "Take photos of the actual space. Don't worry about clutter — we just need to see the dimensions and current state."
- Upload component: tap to take photo (mobile) or drag/drop (desktop)
- Minimum: 1 photo — encourages 3–5
- Each upload goes to Cloudinary → saved as `SPACE_PHOTO` asset
- Optional caption field per photo: "What should we know about this photo?"

**Step 4 — Inspiration**

Split into three sub-sections (tabs or sequential):

*A. Inspiration Photos*
- "What have you seen that you love?"
- "Screenshot from Pinterest, Instagram, Houzz — anything goes."
- Upload component → saved as `INSPIRATION_PHOTO`
- Optional caption: "What do you love about this?"

*B. Product Links*
- "Found a specific product, hardware, or finish you want to use?"
- Repeating URL input field (add up to 5 links)
- Label field: "What is this?" (e.g., "Door handle from Amazon")
- Saved as `PRODUCT_LINK`

*C. Inspiration Links / Videos*
- "YouTube video, website, or anything else that shows the vibe?"
- Repeating URL input (up to 3)
- Saved as `INSPIRATION_LINK`

**Step 5 — Final Notes**

- "Anything else we should know?" (large textarea)
- "Is there anything you've seen done before that you absolutely DON'T want?" (optional textarea — captures negative preferences, crucial for AI)
- "How did you hear about Sublime Design NV?" (optional)

**Step 6 — Confirm & Submit**

- Summary card showing: service type, space, style keywords, # of photos uploaded, # of links
- "We'll generate your design concept and reach out within [X hours]."
- Submit → triggers vision generation job → redirects to `/vision/[leadId]` with status

---

## Phase 3 — AI Vision Generation

### API: `POST /api/leads/[id]/generate`

Triggered automatically on intake submission (or manually from dashboard).

**Process:**

1. Pull all lead data: `intakeData`, `projectNotes`, all `LeadAsset` records
2. Assemble a structured prompt (see below)
3. Call AI (use existing AI integration or OpenAI `gpt-4o` with vision)
4. Store result in `Lead.visionResult` as JSON
5. Update `Lead.visionStatus` to `COMPLETE`
6. Update `Lead.status` to `VISION_GENERATED`

**Prompt Assembly:**

```ts
function buildVisionPrompt(lead: Lead & { assets: LeadAsset[] }): string {
  const intake = lead.intakeData as IntakeData
  
  return `
You are a professional custom woodwork design consultant helping a client visualize their project before construction begins.

PROJECT DETAILS:
- Service: ${lead.serviceType}
- Space: ${intake.space}
- Style preferences: ${intake.styles?.join(', ')}
- Budget range: ${intake.budget || 'not specified'}
- Timeline: ${intake.timeline}
- Contractor notes: ${lead.projectNotes || 'none'}

CLIENT'S OWN DESCRIPTION:
${intake.finalNotes || 'No additional notes provided'}

THINGS THEY DO NOT WANT:
${intake.dontWant || 'Not specified'}

SERVICE-SPECIFIC DETAILS:
${JSON.stringify(intake.serviceDetails, null, 2)}

INSPIRATION SOURCES:
${lead.assets.filter(a => a.type === 'INSPIRATION_LINK' || a.type === 'PRODUCT_LINK')
  .map(a => `- ${a.type}: ${a.url} — "${a.caption || 'no caption'}"`)
  .join('\n')}

UPLOADED PHOTOS:
${lead.assets.filter(a => a.type === 'SPACE_PHOTO' || a.type === 'INSPIRATION_PHOTO')
  .map(a => `- ${a.type}: ${a.url} — "${a.caption || 'no caption'}"`)
  .join('\n')}

Based on all of the above, generate a detailed design concept. Return a JSON object with these fields:

{
  "headline": "Short, exciting 6-10 word title for this project concept",
  "visualDescription": "2-3 paragraph rich description of what this project will look and feel like. Be specific about materials, finishes, proportions, and how it will transform the space. Write as if describing a finished photo.",
  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "materialSuggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "colorPalette": [
    { "name": "color name", "hex": "#xxxxxx", "role": "what it's used for" }
  ],
  "moodKeywords": ["word1", "word2", "word3", "word4"],
  "imageGenerationPrompt": "A detailed prompt suitable for DALL-E or Midjourney to generate a photorealistic render of this exact project. Include room context, lighting, materials, style, camera angle.",
  "contractorNotes": "Internal notes for the contractor: scope clarity, potential challenges, questions to clarify at bid time, estimated complexity."
}

Return ONLY the JSON object. No preamble, no markdown fences.
`
}
```

**Image Generation (optional enhancement):**
After getting the vision JSON, call DALL-E 3 with `imageGenerationPrompt` to produce an actual render. Store as a `LeadAsset` with type `VISION_RENDER`.

---

## Phase 4 — Vision Result Page (Client-Facing)

### Route: `/vision/[leadId]`

**If `visionStatus === GENERATING`:**
- Animated loading screen
- "We're building your concept..." with progress indicators
- Auto-polls every 3 seconds

**If `visionStatus === COMPLETE`:**

Display:
1. **Headline** — large, bold, branded
2. **AI Render** (if generated) — hero image
3. **Visual Description** — rich text, 2-3 paragraphs
4. **Key Features** — icon list
5. **Color Palette** — swatch display
6. **Mood Keywords** — pill/chip tags
7. **Material Suggestions** — card list

CTA section:
- "Love what you see? We're ready to build it."
- Button: "Request Your Quote" → sends notification to contractor + updates lead status to `BID_READY`
- Button: "I want to make some changes" → links back to intake with pre-populated data

---

## Phase 5 — Contractor Dashboard

### Route: `/dashboard/leads`

**Lead list view:**
- Filterable by status (`LeadStatus` enum)
- Columns: Name, Service, Status, Created, Last Activity
- Status badges with color coding
- Click → lead detail

### Route: `/dashboard/leads/[leadId]`

**Lead detail view — tabbed:**

*Tab 1: Overview*
- Contact info
- Service type + intake summary
- Status timeline (sent → started → complete → vision → bid)
- Quick actions: Send reminder, Mark bid ready, Archive

*Tab 2: Client Media*
- Grid of space photos with captions
- Grid of inspiration photos with captions
- List of product links (clickable)
- List of inspiration links (clickable)

*Tab 3: AI Vision*
- Full vision result display (same as client view)
- `imageGenerationPrompt` shown as copyable text (useful for external image tools)
- `contractorNotes` shown prominently
- "Regenerate Vision" button (re-runs generation)

*Tab 4: Communication*
- Timeline of: intake link sent, client opened, client submitted, vision generated, bid requested
- Manual note field for contractor

---

## FieldMetriQ lead handoff

Public quote requests (`POST /api/quote` after `saveLead`), completed intake submissions (`PATCH /api/intake/[token]` with `INTAKE_COMPLETE`), and bid requests (`POST /api/intake/[token]/bid-request`) send one `lead.created` event per save. A later bid request repeats the same intake lead id as `sourceLeadId`, which FieldMetriQ accepts as a duplicate instead of a second lead. The homeowner response does not depend on that call. Existing quote, intake, and bid emails are unchanged. Inbound `POST /api/webhooks/fieldmetriq` is unchanged.

Contract and env vars: see the lead-intake section of `FM_WEBHOOK_STATE.md`. Names: `FIELDMETRIQ_LEAD_INTAKE_URL`, `SDNV_WEBHOOK_SECRET`.

## Environment Variables Required

```env
# Existing
DATABASE_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=

# New
OPENAI_API_KEY=                    # for vision generation + image render
TWILIO_ACCOUNT_SID=                # for SMS intake link delivery
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
NEXT_PUBLIC_BASE_URL=https://sublimedesignnv.com
INTAKE_LINK_EXPIRY_DAYS=30         # token expiration (optional)
FIELDMETRIQ_LEAD_INTAKE_URL=
SDNV_WEBHOOK_SECRET=
```

---

## File Structure

```
/app
  /intake/[token]/
    page.tsx                       ← Client intake form (multi-step)
    IntakeForm.tsx                 ← Step controller component
    steps/
      WelcomeStep.tsx
      ProjectBasicsStep.tsx
      SpacePhotosStep.tsx
      InspirationStep.tsx
      FinalNotesStep.tsx
      ConfirmStep.tsx
  /vision/[leadId]/
    page.tsx                       ← Vision result (polls until complete)
    VisionCard.tsx
  /dashboard/leads/
    page.tsx                       ← Lead list
    [leadId]/
      page.tsx                     ← Lead detail (tabbed)
      tabs/
        OverviewTab.tsx
        MediaTab.tsx
        VisionTab.tsx
        CommunicationTab.tsx

/lib
  /ai
    buildVisionPrompt.ts
    generateVision.ts              ← OpenAI call + image gen
  /twilio
    sendSMS.ts
  /cloudinary
    uploadLeadAsset.ts             ← signed upload for lead assets

/api
  /leads/
    route.ts                       ← GET list, POST create
    [id]/
      route.ts                     ← GET, PATCH
      upload/route.ts
      generate/route.ts
  /intake/
    send/route.ts
    [token]/route.ts               ← GET lead by token (public, limited fields)
```

---

## Implementation Order

1. **Prisma schema** — add models, run migration
2. **API routes** — leads CRUD, upload endpoint, token lookup
3. **Intake form** — multi-step UI, uploads, submission
4. **Vision generation** — prompt assembly, OpenAI call, store result
5. **Vision result page** — polling + display
6. **Send intake link** — Twilio SMS + Resend email
7. **Contractor dashboard** — lead list + detail view

---

## Notes for Claude Code

- Use existing Prisma client instance from `/lib/prisma.ts`
- All Cloudinary uploads should use signed upload via server-side API route (never expose secret to client)
- Intake form state should persist in `localStorage` as backup in case client closes tab mid-flow
- The intake route `/intake/[token]` must be fully public (no auth)
- Dashboard routes require existing auth middleware
- Vision generation should run as a background job — POST to `/api/leads/[id]/generate` returns immediately with `{ status: 'GENERATING' }`, client polls `/api/leads/[id]` for status change
- All AI calls go through server-side API routes only
