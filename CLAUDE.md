# Afik Hanahal Website — Project Instructions

## Bilingual content rule (MANDATORY)

This site is fully bilingual: Hebrew (`he`) and English (`en`).

**Every Hebrew string added to the codebase must have a matching English translation.** No exceptions.

### Where translations live

| Type of content | How to add it |
|---|---|
| Section headers, labels, short UI text | Add both `he` and `en` keys in the `TR` object at the top of `App.jsx` |
| Data-array items (steps, services, FAQ, testimonials, stats) | Add `en_title`, `en_desc`, `en_q`, `en_a`, `en_label`, `en_quote`, `en_designation` etc. alongside the Hebrew field |
| Component internal text | Read `lang` from `useTheme()` and render `lang === 'en' ? en_value : he_value` |

### Pattern to follow

**TR object:**
```js
const TR = {
  he: {
    myNewKey: 'טקסט בעברית',
  },
  en: {
    myNewKey: 'English text here',
  }
}
```

**Data arrays:**
```js
{ title: 'כותרת עברית', en_title: 'English title',
  desc:  'תיאור בעברית', en_desc:  'English description' }
```

**Component rendering:**
```jsx
const { C, lang } = useTheme()
const t = TR[lang] || TR.he

// for TR keys:
<h2>{t.myNewKey}</h2>

// for data-array items:
<h3>{lang === 'en' && step.en_title ? step.en_title : step.title}</h3>
```

### English quality standard

- Natural, professional real-estate English (not word-for-word literal translation)
- Consistent terminology: "plot" / "land" / "property" / "Tabu registration" / "Sharon region"
- Keep names untranslated: "Afik Hanahal", "Israel Ben-Yehuda"

## Tech stack

- React (Vite), single-file component `src/App.jsx`
- Theme + language context: `ThemeCtx` (provides `C`, `isDark`, `lang`, `setLang`, `toggleTheme`)
- Language toggle button in the navbar switches between `he` ↔ `en`
- RTL (`dir="rtl"`) when Hebrew, LTR when English — already handled by the `useEffect` on `lang`

## Property intake system (`/newproperty`)

Sellers and landlords fill a Typeform-style questionnaire at `https://www.afikhanahal.co.il/newproperty`
(direct link only, `noindex`, not linked from the site). Everything is stored in Supabase, completely
separate from leads:

| Piece | Where |
|---|---|
| Questionnaire (steps, Hebrew/English text, headline + story generators) | `src/sellerFormSchema.js` |
| Form UI (mobile-first, drafts, uploads, share link) | `src/SellerForm.jsx` |
| Public summary page `/newproperty/<token>` + owner verification | `src/PropertySummary.jsx` |
| API (drafts, uploads, submit, summary, admin, publish) | `api/seller-form.js` |
| Admin tab "נכסים שנקלטו" (property card, media library, publish) | `src/SellerSubmissionsTab.jsx` |
| DB + storage buckets | `server/seller-submissions-migration.sql` |

**One-time setup** (Supabase → SQL editor): run `server/seller-submissions-migration.sql`. It creates the
`seller_submissions` table and two buckets: `seller-uploads` (private: photos, videos, plans, documents,
one folder per property `<sid>/<kind>/…`) and `property-media` (public: photos copied at publish time).
Env vars are listed in `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY` are required).

**Pipeline:** draft → new → review → approved → published → inactive / sold. A new submission notifies
the office (WhatsApp + email) and shows up in the admin panel like a new lead (sidebar badge, toast,
chime). "פרסם באתר" pushes the property into the existing property generator (`PUT /api/properties/:id`
on the Render backend); rentals land in the `rentals` category, sales in `apartments` / `land` /
`commercial`. Marking a published property sold/inactive hides it on the site automatically.

## SEO content engine (`content/` → static pages)

Crawlable bilingual pages are generated at build time (`npm run build` = `vite build && node scripts/build-content.mjs`)
and written into `dist/` **next to** the SPA, so Vercel serves them before the SPA rewrite:

| Content | File | URLs |
|---|---|---|
| Company facts, UI strings, CTA presets | `content/site.mjs` | – |
| Services (money pages) | `content/services.mjs` | `/services/<slug>/`, `/en/services/<slug>/` |
| Local pages | `content/areas.mjs` | `/areas/<slug>/` |
| Guides | `content/guides.mjs` | `/guides/<slug>/` |
| Glossary | `content/glossary.mjs` | `/glossary/<slug>/` |
| Calculators | `content/tools.mjs` | `/tools/<slug>/` |
| Company profile | `content/company.mjs` | `/company/` |

Every page has `he` and `en` objects (both mandatory), JSON-LD (`@graph` sharing `https://afikhanahal.co.il/#org`),
hreflang, OG image, a 3-step lead form posting to `/api/contacts` (source `page_<type>_<intent>`), and a related-links
block. `related.*` slugs are validated: the build **fails on a broken internal link**. `sitemap.xml` and `llms.txt`
are generated from the same data — do not hand-edit them. Purchase-tax brackets live in both `content/tools.mjs`
and `src/RealEstateCalc.jsx`; update both every January.

## WhatsApp automations (admin tab "אוטומציות")

Ready-made WhatsApp messages for every lead, sent through Green API (`WA_GREENAPI_INSTANCE` / `WA_GREENAPI_TOKEN` in Vercel):

| Piece | Where |
|---|---|
| Templates (Hebrew + English), placeholders, quiet hours, reply detection — shared by server and browser | `lib/automations-shared.js` |
| Engine: welcome on new lead, stage-change messages, no-reply sequence, reply intent, re-engagement, send log | `lib/automations.js` |
| API (`/api/meta/auto-*`: config, run, send, skip, optout, test, log, leads, status) | `api/meta.js` → `handleAutomations` |
| Admin tab shell: Today (approvals + upcoming), Rules, Log, System status drawer | `src/AutomationsTab.jsx` (+ `src/AutomationsApi.jsx` for the eager API/prompt) |
| Templates tab (library, full-screen editor with phone preview, starters, safe delete) | `src/TemplateStudio.jsx` |
| Sending hours tab (presets, week editor with 30-min handles) · no-reply timeline | `src/WeekSchedule.jsx` · `src/SequenceBuilder.jsx` |
| Bulk sends (server-side jobs, 3-step wizard, schedule / send now) | `src/CampaignsTab.jsx` |
| UI kit (tokens, buttons, dialogs, popovers, toasts) · WhatsApp formatting | `src/automationsUI.jsx` · `src/waFormat.jsx` |
| DB tables `app_settings`, `automation_log` | `server/automations-migration.sql` |

Every rule has a mode: `off` · `suggest` (waits in the approval queue, sent with one click) · `auto`. Hooks: `api/contacts.js`
POST → `onLeadCreated` (welcome), PATCH with a new `leadStatus` → `onStageChanged`; the admin panel calls `auto-run` every
5 minutes while open, and `api/cron/warm.js` runs it daily. Per-lead state is `contacts.crm_data.auto` (sent / skipped /
optOut / intent / stageAt). Automations only touch leads, replies and stage changes after `config.installedAt`, and a lead
who replied "no thanks" gets nothing more. Leads from the English site (`crm_data.origin.lang = 'en'`) get the English text.
Keep every template bilingual (`he` + `en`, `he_title` + `en_title`).

Scheduled bulk sends are jobs in `app_settings` (`automations_jobs`), rendered at send time, max 20 messages per run;
`auto-jobs-tick` pushes a running job from the open panel. `auto-tick?key=` (key = `AUTOMATION_KEY`, or the admin token)
lets an external pinger such as cron-job.org run the engine every 5 minutes, so timing is exact even with the panel closed.
Sending hours are `[start, end)` per weekday in 0.5-hour steps (Israel time); welcome, replies and stage messages ignore them.

## Admin dashboard, Google Analytics & chat names

A direct visit to `/admin-panel(/<tab>)` (or `/dashboard`) opens the full-screen dashboard (sidebar layout, `AdminPanel standalone`);
the in-site modal is only used when the admin is opened from the site itself. `DASHBOARD_MODE` in `App.jsx` is decided once at load.

| Piece | Where |
|---|---|
| Home page (greeting, KPIs, live system status, pipeline, recent activity) | `src/AdminHome.jsx` |
| Google Analytics tab (KPIs vs previous period, trend, channels, pages, devices, cities, events, heat map, realtime) | `src/GA4Tab.jsx` |
| GA4 Data API client (service-account JWT, batch reports, 5-min cache, realtime) | `lib/ga4.js` (+ `lib/ga4.test.mjs`) |
| API: `GET /api/meta/ga4?days=7|28|90[&fresh=1]`, `GET /api/meta/ga4?realtime=1` | `api/meta.js` → `handleGA4` |

GA4 needs `GA4_SERVICE_ACCOUNT_JSON` in Vercel (service account with Viewer on property `536943897`, Analytics Data API enabled);
`GA4_PROPERTY_ID` defaults to `536943897`. Without it the tab shows the setup steps. The old Supermetrics route is kept as a fallback
only (its trial ended 2026-06-16).

WhatsApp chat names (`chat-list`): outgoing Green API messages carry no contact name, so names are resolved server-side from
leads (`contacts`), `meta_leads`, the WhatsApp phone book (`getContacts`) and, for a few chats per poll, `getContactInfo` —
all matched by the last 9 digits and cached for 10 minutes. The office's own / notification number is flagged `office` and shown
as "המשרד · התראות מערכת"; a number without any name is shown as 05X-XXX-XXXX.

### Admin appearance (light / dark / system) & command palette

The admin has its own theme, separate from the public site, saved in `localStorage` (`afik_admin_theme`: `dark` · `light` · `system`).
`src/adminTheme.js` holds the store (`useAdminTheme`), the admin `C` palettes (`ADMIN_DARK_C` / `ADMIN_LIGHT_C`, provided through
`ThemeCtx` by both admin mount points in `App.jsx`) and `ADMIN_THEME_CSS` — CSS variables on `html[data-admin-theme]` that every
admin component uses, portals included. When adding admin UI, never hardcode dark colors: use `T.*` from `automationsUI.jsx`
(now CSS variables), `C.*` from `useTheme()`, or `var(--au-*)`; for tints use `rgba(var(--ink), a)` (text) and
`rgba(var(--ov), a)` (surfaces). Purple has three roles, all ≥ 4.5:1 contrast: `var(--au-brand)` (fills with white text),
`var(--au-brand-text)` / `T.brandText` (purple text) and `rgba(var(--brand-rgb), a)` (tints and lines); `C.purple` is the theme's
balanced purple for code that appends a hex alpha. WhatsApp bubbles and the phone preview stay dark on purpose.
`src/CommandPalette.jsx` — Ctrl/⌘ + K (or the top-bar search) jumps to any screen, lead (opens the chat) or property, and runs actions.

### Lead card & smart lead analysis

Clicking a lead (board card, mobile card, table "open") opens `src/LeadCard.jsx` — a centered card with tabs: details
(contact, needs: deal type / budget / timeline / financing / area, property, management: priority / owner / follow-up / tags),
notes & activity (`crm_data.notes: [{ id, text, ts }]`), tasks (`crm_data.tasks: [{ id, text, due, done }]`) and smart analysis.
Every field saves on its own through `updateLead` → `PATCH /api/contacts` (merged into `crm_data`).

Analysis = `POST /api/meta/lead-analyze { lead }` (`api/meta.js` → `lib/lead-analyze.js`): builds a dossier (lead + crm_data,
WhatsApp history from Green API, `automation_log`, repeat inquiries in `contacts` / `meta_leads`, the matching listing from the
property catalog), scores it with the pure, tested rules in `lib/lead-intel.js` (0–100 with signed, explained factors, missing
info, next best action) and asks Claude (`claude-opus-5`, structured output, server-side refusal fallback) for a briefing that
may adjust the score by ±15. The result is stored as `lead.enrichment` (`version: 2`, `score100`, `grade`, `factors`, `brief`, plus
the legacy `score` 1–5 / `intent`). Without `ANTHROPIC_API_KEY` in Vercel the endpoint returns the dossier and the panel runs the
briefing through the Render AI proxy, merged with `mergeBrief()`.

### Property share links (`/p/<id>`)

Every property has a short share link `https://afikhanahal.co.il/p/<id>` (`vercel.json` rewrite → `api/properties.js?share=<id>`,
rendered by the pure, tested `lib/share-page.js`). Link-preview crawlers (Facebook / Instagram / WhatsApp / LinkedIn / X / Telegram…)
get an HTML page with the property's Open Graph tags (title · place, price · specs, first photo via `/media`, JSON-LD); people get
an instant 302 to `/?p=<id>#properties`, keeping `utm_*` / `fbclid` / `gclid` / `lang`. Hidden or missing properties get the
generic preview. The site's own share button uses the same link, and the landing UTM is kept for the whole session
(`sessionStorage.afik_utm`) so `crm_data.origin.utm` credits the ad even after browsing.

Admin → property list → "שתף" (or ⋯ → "שיתוף ופרסום") opens `src/PropertyShare.jsx`: the link with a live preview, per-channel UTM
links (Facebook, Instagram, WhatsApp, colleagues, Yad2, Google; `utm_campaign=prop-<id>`), a custom UTM builder, ready-made post and
colleague texts (Hebrew / English), one-tap share buttons, a QR code generated in the browser (`qrcode`) and a Facebook debugger link.

## GovMap parcel map (`src/GovMapWidget.jsx`)

The property modal and the property wizard show a GovMap map zoomed to the property's gush/helka. The parcel point
is resolved server-side by `GET /api/properties?parcel=<gush>-<helka>` (`lib/parcel-locate.js`, tested), which asks
several GovMap sources in parallel (new-platform parcel WFS, open-data `Parcels_ITM` WFS, the new search autocomplete,
legacy TldSearch) and returns the point in ITM, Web Mercator and WGS84; hits are cached on the CDN for a month. The
widget zooms with `govmap.zoomToXY` (ITM, level 13), verifies the landing through the map's `EXTENT_CHANGE` events
(switching to Web Mercator / level 10 if the SDK didn't move), and always shows a status chip (locating / shown /
not found + "פתח ב-GovMap" + retry) instead of failing silently. The legacy `es.govmap.gov.il/TldSearch` service
alone is no longer relied on.
