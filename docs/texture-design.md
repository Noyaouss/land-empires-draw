# Texture canvases

Approved scope: add grass, sand, rock, snow and forest-floor 64×64 canvases to the drawing app, with a repeated preview for checking joins. Reuse existing drawing, local saving and PNG sync. Game rendering changes are separate.

Plan: test category availability after cached/remote configuration; test repeated pixels; implement category merging and a read-only 3×3 preview; check affected category, store, sync and picture tests plus TypeScript and browser drawing/save/reopen on desktop and tablet; independent review before handoff.

Budget: estimate 8,000 tokens; firm limit 12,000 including input/output and cached input. Starting and live usage counters unavailable; cached usage cannot be separated. Prior instruction reads and exploration count against this same budget; use conservative checkpoints. No image generation planned.

Risk: visible tile seams/repetition. The preview exposes them; it does not automatically repair them. Remote categories must not hide the built-in texture category. Preview pixels must never replace the saved tile.

Verification: the new test initially failed because the preview module was absent. The affected texture/category/store/sync/picture tests pass (25 tests across five files; the store expectations were updated and its six tests rerun). TypeScript and diff whitespace checks passed. These cover category merging, persistence, upload neighbours and source pixels; a full suite and game performance checks are unnecessary because game code did not change.

Chromium at 1366×900 and 768×1024 passed all five material selections, offline drawing/local save, every pixel of the 3×3 preview, 64×64 PNG round-trip, reload/reopen, no horizontal overflow, and existing item sheet/shadow controls. No browser exceptions. Independent reviewer: no findings. Actual tablet pen hardware and authenticated GitHub upload were not checked.

Review: game at http://localhost:5200/; drawing app at http://localhost:5201/land-empires-draw/ so both remain available as requested. Publication/merge awaits owner acceptance. Usage checkpoint: live/starting/cached counters remain unavailable, so exact spent and remaining tokens cannot be reported; no delegated usage meter or image generation was used. Do not reset the original 12,000-token budget.
