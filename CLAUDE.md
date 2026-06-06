# Sublime Design NV

## Cowork handoff protocol

This repo is paired with a Claude Cowork planning session. Shared folder:
`/Users/brandon/Documents/Claude/Projects/Sublime Design NV/` (referred to as $HANDOFF below).

**Specs** arrive as `$HANDOFF/PHASE-N-SPEC-*.md` (or `$HANDOFF/specs/`). When Brandon says
"run phase N" or "run spec <name>", read that file and execute it.

**On completion of any spec (always do all three):**

1. **Write the report** to `$HANDOFF/reports/<SPEC-NAME>-REPORT.md` containing:
   - Status: complete / partial / blocked
   - Files created/changed (paths)
   - Migration names (if any) and whether they were applied locally
   - Acceptance checklist from the spec with pass/fail per item
   - Sample output for any new endpoint (real request/response)
   - Anything deferred, plus open questions for Cowork
   - Current git branch + latest commit hash
2. **Refresh the Cowork code mirror:**
   ```bash
   rsync -a --delete --exclude='node_modules' --exclude='.next' \
     ./ "/Users/brandon/Documents/Claude/Projects/Sublime Design NV/sublime-design-nv/"
   ```
3. **Never push, deploy, or run migrations against the production DATABASE_URL** unless the
   spec's manual-deploy section explicitly instructs it. Local commits are fine.

Brandon then tells Cowork "report is ready" — Cowork reads the report file directly. No
copy-pasting between the two assistants.
