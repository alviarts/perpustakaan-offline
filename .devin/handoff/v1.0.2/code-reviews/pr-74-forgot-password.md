# Code Review — PR #74: Forgot Password Flow via Security Question

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/74
**Branch:** `devin/1777898016-forgot-password` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 13 files, +1089 / -34 (net +1055)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve with comments**

The implementation is well-considered for a fully-offline desktop app. The threat model is correctly scoped (no network, attacker has local FS access), bcrypt is used consistently, and username enumeration is properly defended. Three observations worth recording — none block merge, two are pure defense-in-depth.

---

## What this PR does

Adds an offline-only "Forgot Password" flow rooted in a per-user security question with a bcrypt-hashed answer, since there's no email/SMS channel available.

### Backend (Rust / Tauri commands)

`apps/desktop/src-tauri/src/commands/auth.rs:140–305` — three new `#[tauri::command]` functions:

1. **`auth_get_security_question(username)`** — looks up the configured question for a username. Returns `Option<String>`. **Always returns `Ok(None)`** in every "not eligible" branch (user doesn't exist, account inactive, no question configured, blank question/hash) — explicitly defended against username enumeration.
2. **`auth_reset_via_security_question(username, answer, new_password)`** — verifies bcrypt hash of the normalized answer, then bcrypt-hashes and writes the new password. Wrong answer → `InvalidCredentials`. Inactive account → `InactiveAccount`. New password validation `≥ 6 chars` (matches existing `reset_password` rule).
3. **`auth_set_security_question(user_id, question, answer)`** — sets/updates question + bcrypt-hashed answer. Used from `AkunPage` (admin) and presumably also intended for first-time admin self-setup. Validates answer `≥ 2 chars` and question non-empty.

`normalize_security_answer()` at line 169 — the contract is explicit: trim, collapse internal whitespace runs, lowercase ASCII. Mirrors v1 Python prototype rule (per docstring). Has 4 unit tests covering trim, collapse, blank input, and bcrypt round-trip with surface-form variation.

### Database (`apps/desktop/src-tauri/src/db/mod.rs:222–227`)

Two additive migrations via `add_column_if_missing`:
- `users.security_question TEXT` (nullable)
- `users.security_answer_hash TEXT` (nullable)

Existing v2 DBs upgrade in place; users without a configured question simply can't use the offline reset until an admin fills one in.

### Frontend (React + TanStack Router)

- **`ForgotPasswordDialog.tsx`** (255 lines) — 2-stage modal (username → answer + new password), with confirm-password field, error-code → i18n string mapping (`invalid_credentials` → `forgot.feedback.wrongAnswer`, `validation` → `passwordTooShort`, anything else → `generic`).
- **`Login.tsx`** — wires the "Forgot password" button (was a `TODO` comment); previously was a no-op `onClick`. Adds `data-testid="login-forgot"` for E2E test addressability.
- **`AkunPage.tsx`** — adds the admin-side "Set Security Question" sub-flow with 5 preset Indonesian-themed options (`pet`, `school`, `city`, `book`, `teacher`) + custom-question fallback.
- **`auth.ts`** — three new exported helpers (`getSecurityQuestion`, `resetViaSecurityQuestion`, `setSecurityQuestion`), each with `isTauri()` branch + browser-mode mock backed by an in-memory `MOCK_SECURITY_DB`.
- **i18n (`auth.json`, `settings.json`, en + id)** — full new `forgot.*` namespace under `auth`, plus `sections.akun.security.*` strings.

### Tests

- **Rust:** 4 new `#[test]` cases in `auth.rs` test module covering normalization edge cases.
- **Frontend unit:** 7 `it()` blocks in `tests/unit/forgotPassword.test.tsx` (226 lines), 3 added to `tests/unit/auth.test.ts` (now 8 total). Uses `vi.hoisted()` + `vi.mock('@/lib/auth')` to inject the mock invoke calls.

### Tauri command registration (`lib.rs:101–104`)

Adds the 3 new commands to the `tauri::generate_handler![...]` macro list (additive, no removals).

---

## Strengths

1. **Username enumeration is properly closed.** `auth_get_security_question` returns `Ok(None)` for: missing user, inactive account, missing question, missing answer hash, blank question, blank hash. Attackers cannot distinguish "this user doesn't exist" from "this user exists but has no question". Correct approach for an auth lookup endpoint.
2. **Wrong-answer surface uses `InvalidCredentials`.** Reuses the existing i18n + UI error path. Avoids creating yet-another error code that the UI has to special-case. Frontend correctly remaps to `forgot.feedback.wrongAnswer` so the user gets a context-appropriate message.
3. **bcrypt for both passwords and answers.** Same hashing primitive across both authentication factors. Cost is `bcrypt::DEFAULT_COST` (currently 12), which is appropriate for a local app.
4. **Answer normalization is documented and tested.** The contract (`trim` + collapse whitespace + ASCII lowercase) matches the v1 Python prototype, and is unit-tested with 4 cases including bcrypt round-trip with different surface forms ("Pet name HERE" matches "pet  NAME  here"). This is exactly the right test for a normalization function — verify the hash equivalence end-to-end, not just the string output.
5. **DB migration is additive and idempotent.** `add_column_if_missing` plays well with the existing additive-migrations pattern. Nullable columns means zero risk to existing rows.
6. **Mock browser-mode is correctly scoped.** The mock state lives in a module-local object that resets on reload — won't accidentally persist across HMR refresh. Fine for the dev workflow.
7. **Test coverage is solid.** 19 new test cases across Rust + frontend (4 + 7 + 3 + 5 unit = 19, where 5 unit covers existing+new in `auth.test.ts`). Covers happy path, wrong answer, no-question case, password-too-short, password-mismatch, dialog state reset on close.
8. **TanStack Router idiom respected.** `Login.tsx` uses a state-flag + dialog pattern instead of opening a separate route. Consistent with how other modal forms in this codebase work.

---

## Concerns

### 🟡 1. No rate-limiting on the reset endpoint

`auth_reset_via_security_question` accepts unlimited attempts. There is no lockout, throttle, exponential backoff, or attempt counter.

**Risk in this app's threat model:** low. An attacker who can call this Tauri command already has local file system access (the app runs in the user's session), at which point they can read or replace the SQLite DB at `~/.local/share/id.alviarts.perpustakaan/perpustakaan-v2.db` directly. Brute-forcing the answer through the Tauri IPC is a strictly weaker attack.

**Suggestion (defense-in-depth, low priority):** A simple 3-strikes-then-30s-cooldown table (per-username, in memory) would harden against opportunistic attempts (e.g. someone walking up to an unlocked machine and trying common pet names). Not necessary for v1, can be a follow-up if it ever matters.

### 🟡 2. `auth_get_security_question` may have a small timing-side-channel

The function takes one of three logical paths:

- DB row not found → `Ok(None)`
- DB row found but `aktif == 0` → `Ok(None)`
- DB row found and active but missing question/hash → `Ok(None)`
- DB row found, active, question + hash present → `Ok(Some(question))`

A precise attacker might be able to distinguish "user exists" from "user doesn't exist" via timing differences (the missing-row path returns earlier than the parse-the-row + check-fields path). With local IPC the noise floor is high, but it's worth knowing.

**Suggestion (also low priority):** if you ever care, add a `bcrypt::verify` of the supplied answer against a constant dummy hash on the not-found / inactive paths to make timing flat. Standard pattern from password verification — see [Pony Mail's discussion](https://en.wikipedia.org/wiki/User_enumeration#Mitigation). Same caveat as #1: the threat model probably doesn't justify it here.

### 🟡 3. Validation drift between `set` and `reset`

`auth_set_security_question` requires the *normalised* answer to be `≥ 2 chars`:

```rust
if normalized_answer.len() < 2 {
    return Err(AppError::Validation("jawaban minimal 2 karakter".into()));
}
```

`auth_reset_via_security_question` only requires the answer to be non-empty:

```rust
if normalized_answer.is_empty() {
    return Err(AppError::Validation("jawaban tidak boleh kosong".into()));
}
```

In practice the asymmetry is harmless (a 2+ char answer set via `set` will still verify against the bcrypt hash regardless of which length check the reset path enforces). But the looser check on `reset` is dead code — no answer that passed `set`'s `≥ 2` rule could fail `reset`'s `is_empty` rule.

**Suggestion (cosmetic):** harmonise both to `≥ 2` so the rules read symmetrically and there's one less edge case for future maintainers to think about. Pure cosmetic.

### 🟢 4. Tailwind class reordering noise in `Login.tsx`

Same flavour of churn as PR #76: ~30 lines of class-order shuffling that don't change rendering. Auto-formatter artifact. Harmless but adds review-friction. Not actionable for this PR; flagging for awareness.

### 🟢 5. Mock browser-mode credentials hardcoded in shipped JS

`apps/desktop/src/lib/auth.ts:71` declares:

```ts
const MOCK_SECURITY_DB: Record<string, MockSecurityRecord> = {
  admin: { question: 'Nama hewan peliharaan pertama?', answer: 'kucing', password: 'admin123' },
};
```

This is browser-mode-only (`isTauri()` branch returns first) and fine for development. If anyone ever ships a "browser preview" build of this app to a public URL, they'd want to strip this. Practically not an issue today.

---

## Coordination with other open PRs

### 🟢 PR #77 (rustfmt buku.rs + db/mod.rs)

PR #77 reformats existing `db/mod.rs` content (function bodies + comment alignment). PR #74 adds 6 new lines to the `apply_additive_migrations` function. They touch different lines. After whichever merges first, the other rebases trivially (Cargo.lock is the only file with non-trivial overlap, and it's mechanically resolvable).

### 🟢 Rust command registration (`lib.rs` `tauri::generate_handler!`)

PR #74 adds 3 new commands. PR #69, #70, #75, #76 all add commands too. All edits are additive at different positions in the macro list. Whichever merges second rebases by re-adding its lines — mechanical.

### 🟢 i18n settings JSON

PR #74 adds `sections.akun.security.*` entries. PR #69 (uploader) and PR #76 (manual) also add keys at the end of the same files. Conflicts will be at the JSON tail; resolution is mechanical (combine both new key blocks).

### 🟢 No semantic conflicts identified

Unlike PR #76 ↔ PR #84 (which are mutually exclusive), PR #74 plays nicely with everything else. Merge order does not change correctness.

---

## Summary recommendation

1. **Merge #74 — it's ready.** Threat model is appropriately scoped, primitives are right (bcrypt, additive migration, username enumeration defended), test coverage is solid.
2. **Optional defense-in-depth follow-ups** (file as separate issues, don't block this PR):
   - Add a per-username attempt counter with 30 s cooldown after 3 fails.
   - Make `auth_get_security_question` timing-flat by running a dummy bcrypt verify on the not-found / inactive paths.
   - Harmonise the `set` vs. `reset` answer-length validation (both `≥ 2`).
3. **Accept the Tailwind diff noise.** Same as PR #76 — it's eslint-plugin-tailwindcss auto-fix; out of scope to revert.
4. **No coordination friction** beyond normal additive-line rebases against the other Rust feature PRs.
