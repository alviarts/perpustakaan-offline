# READ ME FIRST

**Hi next Devin.** Before you do *anything* on the v1.1.0 batch:

1. Open [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) and read the
   **"CURRENT PICKUP STATE"** block at the very top.
2. **D1-SystemHealthWidget is paused mid-flight on draft PR #156.**
   Branch: `devin/1778110600-feat-system-health`. All local gates were
   green at the WIP commit (typecheck, lint, i18n:lint, test 579/579,
   build, cargo check). Your FIRST job is to finish that PR — wait CI,
   flip draft → ready, squash-merge — NOT to re-claim D1 from scratch.
3. Only after D1 is merged + marked DONE on `PROGRESS.md` do you proceed
   to **D5-SandboxDemoMode → E1-OPACBukuPilihan → RELEASE 1.1.0**.

If the user pasted you the old v1.0.8 master prompt by mistake, the
batch you're working on is **v1.1.0**, not v1.0.8. The v1.0.8 batch is
already shipped (tag v1.0.12 is on `main`). Read this folder
(`.devin/handoff/v1.1.0/`), not `.devin/handoff/v1.0.8-bugs-batch/`.

Status snapshot: 11/14 DONE (#145–#155), 1 PAUSED-DRAFT (#156), 2 OPEN
(D5, E1), RELEASE pending.
