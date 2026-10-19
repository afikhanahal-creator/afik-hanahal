---
name: admin-visual-editor
description: Add or extend a content management system (CMS) and visual / live-preview editor for the Afik Hanahal site — making site content editable from the admin panel. Use when the user asks for a CMS, an admin content editor, a visual editor, "מערכת ניהול", "עורך ויזואלי", "עריכת תוכן מהפאנל", editing homepage / section / page texts, lists or images without code, drafts / publishing / version history of site content. Enforces the order scan → small question rounds → ADMIN-SPEC.md → wait for explicit approval → build in shippable phases → visual verification. Do NOT use for property management, leads / CRM, WhatsApp automations or analytics screens (they have their own tabs and rules in CLAUDE.md).
license: MIT
compatibility: This repository (Vite + React single-page site, Vercel functions, admin panel in src/AdminPanel.jsx). Playwright for screenshots.
---

# Admin & visual editor

A CMS is judged by two things: the public site looks exactly the same until someone edits it, and the person editing
never needs a developer. Every step below protects one of the two.

## Instructions

### Step 1: Scan what exists — before asking anything
Map, with file:line references:
- **Pages and sections** in render order (homepage sections in `src/App.jsx`, other SPA routes in `src/main.jsx`, the
  static content pages built from `content/*.mjs` by `scripts/build-content.mjs`, the static first-screen layer
  `lib/home-page.js`).
- **Where every piece of content comes from**: the `TR` object, hardcoded data arrays (`PROCESS_STEPS`, `SERVICES`,
  `TESTIMONIALS_DATA`, `FAQS`, …), editable data (properties, `stats` / `sharon` counters, templates), and duplicated
  values (phone, hours, social links repeated inline; `content/site.mjs`).
- **Recurring components** (`SectionBadge`, `GlassCard`, `PropertyCard`, section header pattern, buttons, modals).
- **Graphic language**: `DARK_C` / `LIGHT_C`, fonts (Rubik), type scale, radii, spacing, breakpoints, RTL handling;
  the admin's own tokens (`src/adminTheme.js`, `T` in `src/automationsUI.jsx`, `var(--au-*)`).
- **Content types** and their fields, including the `he` / `en` pairs.
- **What the admin can already edit**, and how it is stored and read by the public site.
Use parallel Explore agents for the sweep; keep only the conclusions.

### Step 2: Ask only what the scan didn't answer — in small groups
- At most 3–4 questions per round (use `AskUserQuestion`), each with 2–3 concrete options and the recommended one first.
- Typical open decisions: scope of the first phase; form + live preview vs editing on the page; who edits (roles);
  lists (edit only vs add / delete / reorder); English (auto-translate vs manual); publishing (instant vs draft →
  publish → history); storage (GitHub commit + rebuild vs Supabase vs other) — state the cost of each in plain Hebrew.
- Never ask what the code already shows. Never ask more than two rounds unless an answer opens a real fork.

### Step 3: Write `ADMIN-SPEC.md` and stop
Sections: the user's decisions (table) · what exists (from the scan) · how it will look (screens, phone layout, draft,
publish, history) · how it works (files, API routes, storage, env vars, security) · out of scope · acceptance criteria ·
phases. Write it in Hebrew for the owner, technical names in English. Commit it, send it to the user, and **wait for an
explicit approval**. No code before that — not even "preparation" refactors.

### Step 4: Build in phases, each shippable on its own
1. **Move the content, change nothing visible.** Extract the content into one source of truth (e.g. `content/home.json`)
   with today's values as defaults; the site reads it at build time. Verify with before / after screenshots of every
   section — phone (390 px) and desktop, Hebrew and English. Any visual difference is a bug.
2. **The editor** (no publishing yet): form + live preview of the real page (an iframe of the site in a preview mode that
   receives the draft by `postMessage`, no analytics, no popups). Drafts autosave in the browser.
3. **Publish, history, restore, translate.**
4. **Images and the final pass.**

### Step 5: Verify before saying "done"
- `npm test` and `npm run build` pass; the content schema has tests and the build fails on invalid content.
- Screenshots of every edited section and of the editor itself, phone and desktop, light and dark.
- An end-to-end edit: change → preview updates → publish → live site shows it (including the static first-screen layer).
- Count what was covered ("X of Y sections editable") and list what the user still has to decide or set up.

## Rules specific to this repository

- **Bilingual is mandatory** (CLAUDE.md): every editable text has `he` and `en`; publishing is blocked while any English
  field is empty. Translation follows the site's terminology ("plot", "land", "Tabu registration", "Sharon region"; names
  untranslated) — use `lib/claude-json.js` `claudeJson()` for an AI translate button.
- **No new Vercel function files** (Hobby limit 12): admin APIs go through `api/meta.js` as `/api/meta/<action>`, guarded
  by `checkAuth`.
- **Admin UI** uses the admin theme tokens only (`T.*`, `var(--au-*)`, `rgba(var(--ink), a)`), works in light / dark,
  is RTL, and works on a 390 px phone (one pane at a time, bottom bar, `.lb-fab` above it).
- **Bandwidth budgets** (CLAUDE.md): don't add Supabase reads per page view (the free egress quota was exhausted in
  October 2026); images never go through a Vercel function; uploaded images are compressed in the browser (≤ 1600 px)
  and cached for a year.
- **Keep copies in step**: when homepage hero / properties texts become editable, `lib/home-page.js` (the static first
  screen) must read the same source; office details (phone, hours, social) must have one source shared with
  `content/site.mjs`.
- **Secrets** (a GitHub token for commits, API keys) live only in Vercel env — never in code, commits or chat; walk the
  owner through creating them one step at a time.
- **Public site performance rules** (CLAUDE.md) still apply: no page-level state that changes on scroll, memoized heavy
  sections, transform / opacity animations only.
