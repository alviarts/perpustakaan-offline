# READ ME FIRST

**Hi next Devin.** Before you do *anything* on the v1.1.0 batch:

1. Open [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) and read the
   **"CURRENT PICKUP STATE"** block at the very top.
2. **D1 has been merged (#156). 12 of 14 items now DONE.**
   The next OPEN items in order are:
   - **D5-SandboxDemoMode** (no deps) — `BUGS.md` line 932.
   - **E1-OPACBukuPilihan** (no deps) — `BUGS.md` line 998.
   - **RELEASE 1.1.0** — bump 4 version files + CHANGELOG, open release
     PR, squash, tag, push.
3. Follow the master prompt (TL;DR section in `SESSION_HANDOFF.md`).
   Claim D5 first (it's larger — schema migration + sandbox.rs +
   SandboxBanner + SandboxPage + audit log).

If the user pasted you the old v1.0.8 master prompt by mistake, the
batch you're working on is **v1.1.0**, not v1.0.8. The v1.0.8 batch is
already shipped (tag v1.0.12 is on `main`). Read this folder
(`.devin/handoff/v1.1.0/`), not `.devin/handoff/v1.0.8-bugs-batch/`.

Status snapshot: 12/14 DONE (#145–#156), 2 OPEN (D5, E1), RELEASE pending.
