---
description: Describe when these instructions should be loaded by the agent based on task context
applyTo: 'qr-pwa/**' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

When to load these instructions
------------------------------
- Load whenever an agent is asked to modify, analyze, or test repository files under the `qr-pwa` workspace.
- Load for tasks that involve PWA behavior, service worker, offline caching, UI changes, accessibility, and simple static deploys (GitHub Pages).

Project summary
---------------
- Name: QR PWA — Generador
- Purpose: Single-page Progressive Web App to generate downloadable QR codes (PNG/SVG), support logos and background images, save presets to `localStorage`, and work offline via a Service Worker.
- No backend: fully client-side.

Tech stack and notable libraries
-------------------------------
- Plain HTML/CSS/JavaScript (ES6+), no bundler.
- UI: Materialize CSS (CDN) and Google Fonts.
- QR generation: `qr-code-styling` loaded from a UMD script tag in index.html.
- PWA: `manifest.json` + `sw.js` (service worker implements caching strategy and update flow).

Repository structure (key files)
-------------------------------
- `index.html`: SPA shell and UI markup.
- `app.js`: app logic (module script), UI wiring, presets in `localStorage`, Service Worker registration, download/share/export flows.
- `sw.js`: service worker — cache name `qr-pwa-v1`, install/activate/fetch handlers, network-first strategy for shell assets, cache-first fallback for others.
- `manifest.json`: PWA metadata and SVG icons under `/icons`.
- `style.css`: global and responsive styles.
- `README.md`: basic dev/run instructions and GitHub Pages note.

How to run locally
-------------------
- Serve the folder from a static server (examples):
	- `http-server . -p 8080` (npm `http-server`) or `python -m http.server 8080`.
- Open `http://localhost:8080/` and test PWA install/Offline behavior.

Testing and QA notes
--------------------
- No automated tests included. Manual checks recommended:
	- Generate QR for each `type` (text, url, wifi, contact).
	- Verify logo and background upload, patterned-SVG option, PNG/SVG downloads.
	- Offline: load, then go offline and refresh — app shell should still serve.
	- Update flow: ensure SW update flow prompts reload as implemented in `app.js`.

Coding & contribution guidelines for the repository
-------------------------------------------------
- Keep changes minimal and focused; prefer small PRs.
- JavaScript:
	- Follow ES6+ style already used in `app.js` (const/let, arrow functions, async/await where appropriate).
	- Avoid adding a bundler unless feature requires it.
- Accessibility: maintain `aria-*` attributes already present (e.g., `aria-label`, `aria-live`). Preserve keyboard behaviors (Enter to generate).
- Internationalization: UI is Spanish; when adding strings, keep them Spanish or provide clear guidance for translation.
- Service Worker:
	- Update `CACHE_NAME` when assets change to force refresh.
	- Preserve existing update flow (postMessage SKIP_WAITING, `controllerchange` handler).
- Assets & icons: keep SVG icons under `/icons` to preserve manifest references.

What the agent should do when asked to modify the project
--------------------------------------------------------
- Prefer edits that keep the app framework-less (no new build step).
- If adding dependencies, include rationale and minimal steps to run locally.
- When touching the service worker, update `CACHE_NAME` and explain cache migration strategy.
- When adding tests or linters, provide minimal scripts and clear instructions to run them.

Contact / further steps
-----------------------
- For feature requests (new export formats, backend sync, presets export/import), propose small incremental changes and include manual test steps.

End of instructions.