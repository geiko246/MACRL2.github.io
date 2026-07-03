# CLAUDE.md — MACRL2 interactive textbook

**Read [`AGENTS.md`](AGENTS.md) first.** It is the full onboarding: what this
repo is, how to build it, author a chapter, add an interactive demo, verify a
change, and how the edit → deploy workflow behaves. This file only adds
Claude-session behavior on top; it does not repeat AGENTS.md.

## Must-know (the traps that bite first)

- **Never edit `dist/`** — it is generated and wiped on every build. Edit
  `content/`, `static/`, `templates/`, `styles.css`, or `site.yaml`.
- A page needs `interactive: true` in front-matter or its `$…$` math and
  `<div class="demo" data-demo="…">` mounts render as nothing.
- A new demo needs three names to match exactly: the file
  `static/demos/NAME.js`, the `data-demo="NAME"` attribute, and
  `window.Demos.register("NAME", …)`.
- Verify with `node --test tests/` before deploying. `npm test` is a stub that
  errors — don't use it.

## Deploy-when-done

When a change is **complete and verified**, deploy it: `git add` → commit →
`git push origin main` (triggers `.github/workflows/pages.yml` → GitHub Pages),
then confirm the run (`gh run watch`) and the live site
https://macrl2.github.io/. Don't leave finished work local; don't deploy
half-finished work. Per global instructions, run commit/push only when the user
has asked — the standing "deploy when you're done" request counts.

## Workspace-local context (not in the committed docs)

Container/workspace specifics — absolute `/workspace` paths, the stray unused
`.venv/`, how puppeteer + headless Chromium were set up for browser smoke, and
this environment's passwordless `sudo` — live in project memory under
`.claude-memory/` (gitignored, auto-loaded), not in `AGENTS.md`/`README.md`
(which are public and project-centric).
