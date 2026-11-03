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

## Homepage content (`content/home.json`) — the CMS source of truth

Every homepage text, list and office detail lives in `content/home.json` (every text is a `{ he, en }` pair): hero (+ typewriter
lines, tags), CEO, story, process steps, services, properties header, testimonials, FAQ, about, office (phone / `tel` /
`whatsapp` / email / facebook / instagram / hours / area) and the playlist. `lib/home-content.js` (tested) holds the rules
(`validateHome` — lengths, list sizes, icons from `HOME_ICONS`, both languages required) and `homeLegacy()` — the shapes the
components already read: `App.jsx` merges its `tr` into `TR.he` / `TR.en` and builds `PROCESS_STEPS` / `SERVICES` /
`TESTIMONIALS_DATA` / `FAQS` / the typewriter from it; inline phone / email / social links use `OFFICE` (= `HOME.office`).
`lib/home-page.js` (static first screen) and `content/site.mjs` (phone, hours, social of the content pages) read the same
file. `scripts/build-content.mjs` fails the build when `validateHome` finds an error. Change homepage copy there, never as a
new literal in `App.jsx`.
**Content editor** (admin "תוכן האתר", `/admin-panel/content`, `src/ContentEditorTab.jsx`; the form layout is
`src/contentEditorSchema.js` — a test fails when a key of `home.json` has no field there): an accordion per area with every
text as Hebrew + English side by side (length counters from `fieldLimit()`), lists with add / duplicate / delete (confirm +
undo) / reorder (drag or arrows) within `listBounds()`, icon and color pickers, and the issues list (`validateHome`, "עבור
לשדה"). The draft autosaves in this browser (`localStorage.afik_cms_home_draft_v1`, with the hash of the version it started
from — a newer live version asks "keep draft / start fresh"); `diffHome()` counts the changes. The live preview is the real
homepage in an iframe, `/?cms-preview=1` (`CMS_PREVIEW` in `App.jsx`): it receives `cms-draft` / `cms-view` (lang, theme) /
`cms-scroll` messages (same origin only), `applyHomeDraft()` writes the draft into the module-level content in place and bumps
`contentVer` in the site context so every section re-renders; in that mode there are no analytics / pixel / CAPI events
(`index.html`, `trackEvent`, `sendCAPI`), no cookie banner, no static first-screen layer, links and forms do nothing, and
reveal-on-scroll items are shown at once. Desktop preview = a 1280 px frame scaled to the pane; phones get one pane at a
time (the preview stays loaded behind the form). Publishing, history and translation are ADMIN-SPEC.md phase 3.

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

**Meta Lead Ads leads** (`meta_leads`, admin "Lead Center") get the same welcome: the webhook (`/api/meta/webhook`, page
event `leadgen`) and every sync call `welcomeMetaLead` → `Auto.welcomeExternalLead` (tested in `lib/automations-welcome.test.mjs`):
the welcome template and on/off switch, sent from the office WhatsApp through Green API, logged in `automation_log` as
`meta:<id>`, `wa_sent` + the thread row on success (the old path tried the Meta Cloud API number first). Safety net for a missed
webhook: `auto-run` (panel, every 5 min) and `auto-tick` sync the last 6 hours of leads, the daily cron runs a full sync — all
idempotent (an INSERT on `leadgen_id` decides "new"). `GET /api/meta/connect[?account=<ad account>][&fix=1]` (admin) checks the
whole chain without exposing secrets: Meta token, pages, each page's `leadgen` subscription (`fix=1` subscribes it), lead
forms and the newest lead on Meta vs in the table, the ad account and its campaigns, Green API state + number, the welcome
rule. Probe action `connect` / `connect-fix` (workflow input `account`). There is no SMS provider — "message" means WhatsApp.
`?quick=1` (token + the configured pages' subscription only) feeds the admin home tile "לידים מפייסבוק (Meta)" and the daily
cron's `metaWatch` (one WhatsApp to the office a day while the token is dead — a password change killed it silently in June 2026).
The token is `META_SYSTEM_USER_TOKEN` in Vercel (a System User token from business.facebook.com → System users, with the page and
the ad account assigned; scopes `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`,
`ads_read`); after replacing it, run `connect-fix` so the page is subscribed to `leadgen`. `fix=1` only touches the office's pages (`META_PAGE_IDS`);
`unsub=<ids>` removes other pages from the app, and the webhook ignores leads from any page that isn't ours. A sync welcomes and
announces only leads ≤ 24 h old; older ones the webhook missed are saved quietly (`savedQuietly`). Probe action `meta-sync`.
Every webhook delivery is recorded in `app_settings` (`meta_webhook_log`: `last`, `count`, last 20 events) and reported by
`/connect` (`webhook`; `?quick=1&green=1` also returns `green` state/number and the `welcome` rule), so a webhook that stopped
arriving is visible. `.github/workflows/lead-tick.yml` calls `auto-tick` every 15 minutes (it was 5 — each run reads the whole lead
list; the webhook and the site's form welcome a lead at once, the tick is the safety net and the no-reply clock; the repo is
public: the log prints counts only), so a lead is welcomed even with the panel closed and the webhook down. The open panel's own
`auto-run` refreshes the approval queue every 15 minutes (was 5).
**Lead Center** (`src/MetaLeadsTab.jsx`, admin "מרכז לידים"): connection dots (Meta / WhatsApp / welcome rule), KPIs, a list
grouped by day (campaigns by their short name, a "קיבלו הודעה / טרם נשלחה הודעה" chip; Meta's testing-tool leads hidden by default;
search matches a phone typed any way), an overview (needs attention, leads by campaign, connection health) and a lead page: a bar
(call / chats tab / CRM, status) over **the WhatsApp conversation** (`src/LeadConversation.jsx`, the chats tab's look from
`src/waShared.jsx`): the number's real history (`chat-history`, conditional, every 8 s while visible) merged with the
`meta_messages` log (`mergeConversation()`), drawn like WhatsApp Web (header with the lead's avatar and round icon buttons,
tailed bubbles with the time tucked into the last line, the 59 px header / 62 px footer, WhatsApp's own colors in light and
dark), and a composer whose **quick replies** (⚡, or "/" at the start of the box — WhatsApp Business style: a window above the
composer with search, a section per category, ↑ / ↓ / Enter / Esc, "★ automation" and "sent ✓" badges, ✏️ per row; groups from
`templateOptions()`, rendered for `templateLead()` = the Meta lead, or its CRM copy from the admin's `leads`; עב / EN) fill the
box; a reply-style bar above the box names the template it came from (edited?), with ✏️ and ✕. While nothing was sent the welcome group comes first
and the box **starts with the automation's welcome** (★), the button reads "שלח הודעת פתיחה" and that first send goes
→ `POST /api/meta/lead-welcome {id, text, templateId}` → `welcomeExternalLead(…, { force: true, text, templateId })` (counts as the
welcome: `wa_sent`, `automation_log`, `by: 'manual'`), and a composer → `POST /api/meta/messages` (502 carries `quota`). A refusal
reads as words (`sendErrorText()`; the 466 quota also shows a banner with the upgrade link), never raw JSON. Next to it: welcome
status, details + form answers, notes (save state shown). The selection is an id (`selectedId`), so polls / Realtime keep the open
lead fresh. **Speed:** the lead list is kept for the session (`sessionStorage.afik_lc_leads_v1` with its ETag) and drawn at once, the read only refreshes it; the WhatsApp history of every chat opened in the session (Green's `getChatHistory` takes ~4 s) is kept in `LeadConversation.jsx` (`HIST`, `sessionStorage.afik_lc_hist_v1`, newest 30) so a lead opened again shows its conversation at once (re-checked conditionally in the background), and hovering a list row for 220 ms prefetches it (`prefetchHistory`) — a hovered lead opens in ~0.1 s. **Resizable like an editor** (`src/Splitter.jsx`, axis x / y: pointer capture, only a DOM style changes while dragging,
committed on release; arrows / Shift / Home / End, double-click or Enter resets): the edge between the list and the lead and
between the conversation and the details (`--lc-list` / `--lc-aside`; the lead keeps ≥ 460 px, the chat ≥ 380 px), the header's
bottom edge (one compact row — title, connection pills, KPI chips, sync, Pipeline — dragged up it folds away and the
conversation grows), and the composer's top edge (a taller writing box, `localStorage.afik_lcv_dock_v1`). Sizes are kept in
`localStorage.afik_lc_layout_v1` (`list`, `aside`, `head`); ⤢ in the conversation header puts it on the whole screen (Esc back).
**The admin opens on the Lead Center** (the default tab; `/admin-panel/overview` is the dashboard home). In the in-site modal
this screen folds the title and the row of tabs into one slim bar (a "מסך" dropdown, "כל המסכים ▾", theme, close; ▴ folds the
row back; `localStorage.afik_admin_tabs_open`). A lead whose WhatsApp chat already has our messages (sent from the chats tab, say) is marked
`wa_sent` (`onActivity` → PATCH `{ wa_sent: true }`, the only value the API accepts). **"כרטיס ליד"** (lead bar, and the person icon in the conversation header — still there when the bar is folded) opens the
CRM lead card over the Lead Center (`onOpenCard` → the admin's `ensureCrmCopy` → `LeadCardWithStages` from `LeadsBoard.jsx`,
lazy). **The chat grows:** the edge under the lead bar drags up (the bar folds to 0, `layout.bar`; double-click brings it back),
the layout key is `afik_lc_layout_v2` (list 320 / details 290 by default, so the conversation opens bigger), and the form card
on top of every conversation (`LeadFormCard`, `src/waShared.jsx`) is folded to one line (its answers in short) until opened —
`localStorage.afik_formcard_open`. **Renaming a lead:** a click on the name (list row or lead header) opens an inline editor with "+ הוספת הפרויקט: <short campaign>"
(appends ` · זרובבל 15`, so the chats show where the lead belongs) → `PATCH /api/meta/leads {id, name}` renames `meta_leads`, the CRM
copy (`findMirror`) and resets the chats' name cache; `onLeadRenamed` updates the admin's `leads` at once. **The other way round is the same name too:** a rename on the leads board / lead card (`updateLead` → `PATCH /api/contacts {name}`) writes the `name` column and `crm_data.name` and, for a Meta lead's copy (`crm_data.metaLeadId`), `meta_leads.name`; the open Lead Center updates at once (`afik:lead-renamed` window event, then Realtime). A Lead Center rename also writes the copy's `crm_data.name` (the board reads crm_data over the columns, so an old one used to win). **The project in the name from the leads tab too:** the lead card's name field has "+ הוספת הפרויקט: <project>" / "הסרת שם
הפרויקט" (`leadProject()` = the Meta campaign's short name, else the listing; `toggleProjectInName()` in `src/lib/leadFields.js`,
tested) and the board's bulk bar has "+ הפרויקט בשם" for every selected lead — both go through `updateLead`, so the Lead Center, the
chats and `meta_leads` follow. A name that already carries the project drops the "(campaign)" after it (`leadCampaignTag()`). **The office
phone's WhatsApp contacts follow, both ways** (2026-11-01, `lib/wa-book.js`, tested): every rename (board / lead card →
`PATCH /api/contacts`, the Lead Center → `PATCH /api/meta/leads`, the chats header's `ChatNameEdit` in `src/ChatLeadTools.jsx`
— a click on the name, "+ הוספת הפרויקט", a chat that isn't a lead → `chat-contact-name`) writes the contact with Green's
`editContact` (else `addContact`, `saveInAddressbook`), and `syncBookNames()` (`lib/automations.js`, in `auto-tick` /
`auto-run`, or `POST chat-book-sync`) compares the phone's `getContacts` names with the last ones seen
(`app_settings.wa_book_names`, by the last 9 digits): a name changed on the phone renames the lead (`contacts` name +
`crm_data.name`, `meta_leads`); the first look only records, our own writes update the baseline so they never bounce. **Pipeline stage from the chat:** the lead header's "שלב בפייפליין" menu (`PIPELINE` in `MetaLeadsTab.jsx`,
the office's renamed stage names through `stageLabels`; the menu is a portal with a fixed position (`.lc-stage-menu--float`) — the lead bar is `overflow:hidden` and used to clip it, and the quick-replies window is capped to the conversation's height, `qMax`) moves the lead's CRM copy through `onCrmStage` → the admin's
`updateLeadStatus` (stage log, nurture follow-up, stage automations — the same as dragging on the board); a lead not in the CRM
yet is copied there first (`lead-to-crm`). A detail pane too narrow for both (and every phone) shows one pane at a time ("שיחה" / "פרטים והערות"); phones get a compact
bar (status as a dropdown, CRM in the details). Pure helpers: `src/lib/leadConversation.js` (tested). **Booking link button:** both message boxes (`ChatComposer` in the chats, `LeadConversation` in the Lead Center / lead card)
have "קישור לשיחה" (calendar icon): puts "אפשר לבחור כאן שעה נוחה לשיחה קצרה: https://www.afikhanahal.co.il/book?ref=wa" at the
cursor — in the language of what is in the box (`&lang=en` in English), never twice (`src/lib/bookingLink.js`, tested). **History per contact:** the aside's "היסטוריה ופרטים שהשאירו" card (`src/lib/leadHistory.js` `leadHistory()` / `crmLeadFor()`, tested): every Meta inquiry from the same phone with its form answers, the CRM copy's website / booking inquiry, booked calls, stage changes, notes and automatic sends, newest first (8, then "הצג הכל"). **Form card on top of the conversation:** both chat views (the Lead Center's `LeadConversation` and the chats tab) open with "הפרטים שהשאירו במודעה / באתר" — the campaign's short name, form, time, **the name as the lead typed it** ("השם שהשאירו בטופס": `raw_fields` full / first + last name, else `crm_data.originalName` — set on every CRM copy by `contactFromMetaLead()` and back-filled for all existing copies on 2026-10-19; both rename paths also save it before the first rename; also shown as "שם בטופס" in the Lead Center's details and as "השם בטופס" under the name in the lead card) and every answer the lead left (`leadFormCard()` in `src/lib/leadHistory.js`, tested; `LeadFormCard` in `src/waShared.jsx`), like Meta's own inbox.
**Every Meta lead is also in the CRM** (`lib/meta-crm.js`, tested): the webhook and every sync copy a new lead into `contacts`
(source `meta`, `crm_data.metaLeadId`, form answers in `message` / `crm_data.formAnswers`, phone as 05X…), so it shows in "לידים" and
in the bulk-send audience. The welcome stays with the Meta pipeline (`crm_data.auto` marks it sent / skipped, the CRM never sends a
second one); a lead saved late (or backfilled) is also marked past the no-reply follow-ups. Test leads, archived leads and leads
without phone or email are not copied. `POST /api/meta/crm-sync` (admin; daily cron; probe action `crm-sync`) copies whatever is
missing; the Lead Center's CRM button calls `POST /api/meta/lead-to-crm {id}`. The admin drops its old browser-only `meta_<id>` copies. **The full sync on opening the panel refreshes the leads this browser already holds** (`syncLeadsFromServer` in `AdminPanel.jsx`; it used to add new leads only, so a server-side rename or state never reached the board until storage was cleared); after that **nothing is polled**: the database announces every change itself (**change bus**, `src/lib/syncBus.js` + `server/sync-bus-migration.sql`: triggers on `contacts` / `meta_leads` / `seller_submissions` → `realtime.send()` on the public Realtime channel `afik-sync` with `{ t: table, id, op }` only — never a name, phone or note) and the open screens fetch just the change: the leads board (debounced 0.8 s), the Lead Center's list (conditional re-read) and the intake badge; a change announced while the window is hidden is fetched when it comes back; a slow 3-minute check runs only while the bus is down (`busUp()`). The fetch is incremental: **new or changed** leads — `contacts.updated_at` (a trigger bumps it on every update; `server/contacts-updated-at-migration.sql`, applied 2026-10-23) → `GET /api/contacts?since=<newest created_at>&changed=<newest updated_at>` (`or=(created_at.gt…,updated_at.gt…)`; cursors `localStorage.afik_leads_since` / `afik_leads_changed`). A note, a rename or a follow-up written on another screen, device or by the server reaches every open screen in about a second; a lead edited on this screen in the last 20 s isn't overwritten by an older server copy (`localEdits`).
**One name everywhere:** **Lead names are saved in Hebrew** (2026-10-24): a Latin name ("Ronen Cohen") is written in Hebrew when the lead
arrives — the Meta webhook and sync (`meta_leads.name`), website forms (`api/contacts.js`) and bookings — by `hebrewFullName()`
(`lib/hebrew-names.js`, tested: ~450 first names, Israeli surnames, then transliteration with final letters; an email, a test
lead or junk stays as typed; a surname typed first is put after the first name — `nameOrder()`: "Bechar Eddie" → "אדי בכר"; a
Hebrew name too, when it is clear — `heNameOrder()`: the first word reads as a surname (a known one or -וביץ / -סקי / -שטיין /
-ברג / -מן / -גר …) and the last is a known first name: "ליבוביץ סופי" → "סופי ליבוביץ" (the typed order stays in
`originalName`; the 3 existing ones were fixed on 2026-10-26); "אידית מאיר" stays — many surnames are first names too). Every
template greets with `givenName()` (`lib/hebrew-names.js`, tested), so "{name}" is the first name either way. **A name
no list knows is proofread by Claude before it is saved** (2026-10-25, `lib/name-proof.js` `properHebrewName()`, tested: the Meta
webhook, a new lead in the sync, website forms; `claude-opus-5-5`, effort low, structured output, 8 s cap; only a confident,
Hebrew-letters-only answer is taken — anything else keeps the list-based spelling, so a lead is never held up; "Bechar" used to become
"בחר" letter by letter). The name as typed stays in `raw_fields` / `crm_data.originalName`, and an English message greets
with it (`renderTemplate`). The existing leads were converted on 2026-10-24 (164 contacts, 178 Meta leads). **Safety net:** `auto-tick` (every 15 min) and the panel's `auto-run` also convert any lead of the last 72 h still named in Latin, in both tables (`lib/hebrew-lead-names.js` `hebrewizeRecentNames()`, tested — `crm_data.originalName` keeps the typed name). every screen shows the lead's current name from the admin's `leads` (kept fresh by the change bus) over a
copy it got earlier — "היום" in the automations (queue rows and the schedule; a message not edited by hand is re-rendered with the
new name), the automations log, the meetings tab (`BookingAdminTab` gets `leads`, a call shows its lead's name via `leadId`), the
chats (lead name over the WhatsApp name) and the Lead Center (the server renames `meta_leads` too).
**The project from the chats header** (2026-11-03): a chat whose number is a CRM lead has the `ProjectChip` (pick, search or
create → `onUpdateLead(id, { projectId, projectName })`); a chat that isn't a lead has "שיוך לפרויקט" (`ChatProjectJoin` in
`src/GreenAPIChat.jsx`) — the same picker, then `POST /api/meta/social-wa-lead { phone, name, projectId, projectName }` saves the
chat as a new lead in that project (its last messages as the first note), and the header turns into the lead's tools once the
change bus brings the lead. `LP_CSS` is exported from `src/LeadProjects.jsx` for screens without the projects bar.
**A rename is verified against the phone** (2026-11-03): WhatsApp keeps its own contact list, and the office phone's address book
follows it only while contact sync is on in the WhatsApp app (Settings → Privacy → Contacts). `saveWaContact()` now reads the
number back (`readWaContact()` in `lib/automations.js`: `getContactInfo` `contactName`, else `getContacts`) and returns
`{ ok, saved, synced }`; `GET /api/meta/chat-contact-name?phone=` only reads. `ChatNameEdit` says what the phone holds after every
save ("בוואטסאפ של המשרד: … ✓"), and when WhatsApp didn't take the name shows an amber "⚠ … · איך מתקנים?" (the header keeps its
62 px) that reopens the editor with the sync steps (`wa-name-hint`).
**Stage + AI note from the chat** (2026-11-01, `src/ChatLeadTools.jsx`): the chats tab's header (for a chat whose number is a CRM
lead) has the pipeline stage as a pill menu (`StageMenu` → the admin's `updateLeadStatus`, the same as dragging on the board; the
stage list and its colors are `src/lib/pipelineStages.js` `PIPELINE`, shared with the Lead Center, names through `stageLabels`) and
"סיכום AI" (`AiNoteButton` → `POST /api/meta/chat-summary` → the summary is saved on the lead by itself as a note, kind `wa`,
`summaryNote()` — tested — plus `crm_data.chatSummary`; a small window then offers the suggested stage and "פולו אפ מחר / בעוד N
ימים" (`addFollowUp`, with a WhatsApp reminder) in one click; errors read as words — an out-of-credit Anthropic account included).
**One list of notes everywhere** (`src/lib/leadNotes.js`, tested): the CRM lead's `crm_data.notes`. The Lead Center's notes card (it used to be a free-text field on `meta_leads.notes`, seen nowhere else) adds to that list through `onCrmPatch` → the admin's `updateLead` on the lead's CRM copy (`ensureCrmCopy` makes one first, like the pipeline menu); the old Meta note joins the list once (`meta_note_<id>`). The chats tab's header has "הערות" (`NotesButton`) and "פולו אפ" for the open chat's CRM lead (`onUpdateLead`); "צפה בליד" opens that lead's card (`/admin-panel/leads?lead=<id>`, read by `LeadsBoard`).
**Follow-up tasks with a WhatsApp reminder** (`lib/follow-up.js`, tested; UI `src/FollowUpTask.jsx`): `crm_data.tasks` items `{ kind: 'followup', due (ISO), remind, remindedAt }`; the lead's `followUp` (Israel-local "YYYY-MM-DDTHH:mm") follows the earliest open one (`addFollowUp` / `updateTasks` / `setNextFollowUp`). Written from the lead card (tasks tab "פולו אפ – לחזור אליהם", the header's bell button, the details field "follow-up"), the call summary ("תזכורת בוואטסאפ כשמגיע הזמן", on by default), the Lead Center (header button + aside card) and the chats header. Quick picks (`followUpPresets`: in 1 h / 3 h, today 17:00, tomorrow 9:00 / 14:00, 2 days, a week, a month — Saturday moves to Sunday). **No polling for reminders:** the database's own scheduler (pg_cron, every minute, inside Postgres — no transfer, no function call) counts the due ones (`public.afik_due_reminders()`) and only when there is one calls `POST /api/meta/auto-remind` (pg_net) with the key it keeps in `app_settings.remind_key` (made in the database, never in code or chat; compared in constant time); a reminder refused 3 times gets `remindGaveUp` and stops being due; `afik-cron-cleanup` trims the scheduler's log daily. `remindTasks()` (`lib/automations.js`) reads only the leads with tasks (`crm_data->tasks`), sends each due reminder once to the office number (`TEAM_CHAT`, one of the numbers Green's free plan still allows) — name, task, campaign, phone, when, wa.me and the card link — and marks it (`app_settings.task_reminders` keyed lead · task · due, 3 tries, `remindedAt` on the task); a moved task reminds again, one more than 24 h late is skipped. **Plain tasks remind too** (2026-10-24): the tasks tab takes a date + time (`format="iso"`, the follow-up quick picks) and a
"תזכורת בוואטסאפ" switch (on) → `{ kind: 'task', due (ISO), remind }`; the reminder reads "תזכורת למשימה: <full name>" with the
task, the project (`על:`), what they look for (`מחפשים:` — `leadNeeds()` from the lead card's fields / form answers), the phone,
wa.me and the card link `/admin-panel/leads?lead=<id>`. `public.afik_due_reminders()` counts every task with `remind` (it used to
count follow-ups only) and reads an old Israel-local due in Israel time (`server/sync-bus-migration.sql`).
**A lead's reply that names a time becomes a task by itself** (2026-11-03, `lib/callback-time.js` + `lib/automations.js`
`onIncomingMessage()` / `scanCallbacks()`, tested in `lib/callback-time.test.mjs` / `lib/callback-task.test.mjs`): every incoming
WhatsApp message (the Green webhook, `handleGreenHook`; safety net: `auto-tick` / `auto-run` over the last 3 hours, ids kept in
`app_settings.callback_seen`) is read for a time — "מחר ב4" → tomorrow 16:00, "מחר בבוקר 9:00", "בשעות הצהריים" → 13:00, "אחרי
שלוש", "ב8 בערב", "בעוד שעה", "ביום חמישי בערב", "עכשיו" (Israel time, Saturday → Sunday, a passed hour → the evening or tomorrow;
`parseCallbackTime()` / `detectCallback()`). A clear one (an hour, a day + a time / part of the day, a time + a call word) counts
alone; a weaker one only as an answer to our question about timing (our last message asked "מתי נוח…?" — `askedForTime()`, ≤ 72 h)
or with a call word; refusals ("לא מעוניין", "לא זמין מחר"), "3-4 מיליון", "2 חדרים" and "בוקר טוב" never count. A short unusual
answer to our question ("אחרי שאסיים בעבודה") goes to Claude (`claude-opus-5-5`, effort low, 8 s; only a sure, future answer in
07–22 — `aiDue()`). The lead is found by phone (`findLeadByPhone`, the CRM copy); then a follow-up task `{ kind: 'followup', remind:
true, auto: 'wa', fromMsg, quote }` ("לחזור לזוהר — ביקשו בוואטסאפ: "…"") — one automatic task per lead, a newer time moves it —,
the lead's `followUp`, a 🔗 note, and a WhatsApp notice right away to the office line + the rule's extra numbers ("משימה חדשה: לחזור
ל… מחר 16:00", the quote, project, phone, wa.me, the card link — `callbackNotice()`). At the time: the on-screen card (`TaskAlerts`)
and the WhatsApp reminder (`remindTasks`, which also sends an `auto: 'wa'` task's reminder to the extra numbers). Not for a lead
marked "לא רלוונטי" / "won". The rule is `rules.callback { mode, notifyNow, notify: [numbers], ai }` — the automations "חוקים" card
"כשליד כותב מתי לחזור אליו" (on / off, notice now, Claude, extra numbers, a live tester); the extra numbers live only in the
database config, never in code. The follow-ups screen marks these tasks "נוצר מהוואטסאפ" (the quote in the tooltip).
**On-screen reminders** (2026-10-25, `src/TaskAlerts.jsx`, mounted once in `AdminPanel.jsx`): the same tasks (`remind`, not done,
due, ≤ 12 h late — `screenReminders()` in `lib/follow-up.js`, tested; the WhatsApp having gone out doesn't matter) pop up in the open
admin on any screen: a card at the top centre (amber, red once more than 2 min late — `lateText()`: "באיחור 26 דק׳") with the lead's
face, name, campaign, phone, time and the task, and **התקשר** (`tel:`) · **וואטסאפ** (the chats tab) · **כרטיס ליד** (the lead card
over the current screen, `reminderCardId`) · **בוצע** (`updateTasks`, done + `doneAt`) · **הזכר לי שוב** (10 min / an hour / tomorrow
9:00). It never closes by itself. A chime (`playReminderSound`, louder than a message), an OS notification that stays until clicked
(`reminderNotify`, `requireInteraction`, tag `task-<key>`) and the tab's badge ("⏰ …") while the window is in the background (the
bell's sound / desktop switches apply). What was shown / snoozed / handled is `localStorage.afik_task_alerts_v1`, shared by every
open tab (a reminder handled in one tab leaves the others); checked every 15 s and whenever the leads change.
**Reminders that make sense** (2026-11-02, `lib/follow-up.js` `reminderAllowed()` / `closeForStage()` / `lastTouch()`, tested): a lead
marked "לא רלוונטי" gets no reminder at all and a closed deal ("won") no "get back to them" follow-up (its plain tasks stay) —
moving a lead there closes those tasks (`updateLeadStatus` → `closed`, `closedBy: 'stage:<stage>'`, the lead's `followUp` cleared),
and every path checks the same rule: the WhatsApp reminder (`dueReminders`, `remindTasks` reads `stage`), the screen card and the
database's due count (`afik_due_reminders()`, applied). The on-screen card pops up only for what is due now — at most 2 h late
(`SCREEN_WINDOW_MS`; older ones wait in the follow-ups screen) — and not for a lead someone already called / noted / moved after the
due time.
**Follow-ups screen** (2026-10-25, `src/FollowUpsView.jsx`; **a call list since 2026-11-02**: a "הכי דחוף עכשיו / הבא בתור" card on
top — the oldest late task, else today's next —, rows of when (time, day, and "באיחור 40 דק׳" / "בעוד שעתיים" as a colored pill), who
(face, name → the lead card, phone, project, stage), what to do (the task in bold, "מחפשים:" from `leadNeeds()`, the last note +
"הערה") and big actions: a green "התקשרות" (`tel:`), WhatsApp, "בוצע", "הזזה", delete): the leads board's "פולו אפים" button next to the view switch
(`FollowUpsButton`, today's + late count — red when something is late; a tab on phones) opens a screen of its own (`activeTab
'followups'`; the board's toolbar is hidden there): a CRM task list of every dated task of every lead (`taskAgenda()` +
`agendaBucket()` in `lib/follow-up.js`, tested) grouped late · today · tomorrow · this week · later · done; KPI tiles (a click filters),
ranges (open · late · today · this week · done · all), kinds (all · follow-ups · tasks), search (name / phone / task); kept in
`sessionStorage.afik_fv_range` / `afik_fv_kind`. A row: done / not done (`updateTasks`, the lead's `followUp` follows), when (time +
day · date, "לא בוצע" when late), **the full name — opens the lead card** (`setDetailLead`), the stage, phone (`tel:`) + WhatsApp (the
chats tab), the task (follow-up / task tag), the project, the lead's last note + "הערה" (added to `crm_data.notes` with `addNote()` —
the lead card's notes list), "הזזה" (the date / time picker with the quick picks — `text` prop shows a label instead of the value; the
reminder goes out again at the new time: `remindedAt` cleared) and delete. Past rows are grey, done ones struck through. "משימה
חדשה": pick a lead (name / phone search), follow-up or task, what, when, reminder (on). A container query turns rows into cards
under 1060 px.
**Who to call, what was missed** (2026-11-03, the same screen): the status tiles read "לא בוצעו בזמן" (red, filled when > 0) · עוד
היום · מחר · השבוע · בהמשך · בוצעו היום; under them **"להתקשר עכשיו"** — cards for what passed in the last 48 h and wasn't done (the
one waiting longest first) and what is due within two hours, one per lead (`callQueue()` in `lib/follow-up.js`, tested), each with
its status, when it was set for, who, the task and a big green call button, WhatsApp, "בוצע"; nothing waiting → "אין כרגע שיחות
שמחכות · הבא בתור: …". Every row says its status in words (`taskStatus()`: "לא בוצע · עבר לפני 2 שע׳" red, "הזמן עכשיו",
"בעוד 40 דק׳", "בוצע"); missed rows are tinted red under a "עבר הזמן ולא בוצע" banner that says what to do (call, mark done, or
move), rows due within two hours carry an amber bar; the kind chip shows only for a plain "משימה" and for "נוצר מהוואטסאפ".
**Ready-made tasks** (2026-11-01, `lib/task-presets.js`, tested; `src/TaskPresetInput.jsx`): the task boxes — the lead card's
follow-up ("פולו אפ – לחזור אליהם") and tasks fields, and the follow-ups screen's "משימה חדשה" — are a combobox: a click or ▾
opens ~45 common CRM tasks in 8 groups (calls · send on WhatsApp · meetings & viewings · qualifying · financing · deal & signing ·
retention & referrals · housekeeping; follow-ups list calls first), typing filters them (Hebrew or English), ↑ / ↓ / Enter / Esc;
a pick fills the text and, when "when" is still empty, its suggested time (`presetDue()`: days ahead at an Israel hour, never in the
past, Saturday → Sunday). Texts the office typed itself come first ("בשימוש לאחרונה", `localStorage.afik_task_recent_v1`, 8).
**Date / time picker** (`src/DateTimePicker.jsx`): every admin date field (lead card follow-up and task due, call summary, the leads dashboard's custom range, bulk-send scheduling) — quick picks, a month calendar (Sunday first, RTL, today marked, arrows / PageUp / PageDown / Home), time chips 07:00–21:00 + any time typed, formats `date` / `local` / `iso` (Israel time); a bottom sheet on phones. `Popover` (automationsUI) ignores clicks inside the picker's portal, and both call `preventDefault` on Esc so the lead card under them stays open.

**Live WhatsApp engine** (2026-10-25 — a lead's reply used to be missing: Green's incoming journal was off, so `getChatHistory`
had none of their messages): Green API delivers every message and status of the line to `POST /api/meta/green-hook`
(`handleGreenHook`; the key is `app_settings.green_hook_key`, made in the database and handed to Green as `webhookUrlToken`,
compared in constant time — never in code or chat) → `wa_messages` (`server/wa-messages-migration.sql`: id = Green's idMessage,
phone, in / out, type, body, file, quoted, status that only moves forward; RLS on, service key only; parsed by the pure, tested
`lib/green-hook.js` `parseGreenHook()`). The insert / update is announced on the change bus (`afik-sync`, `{t:'wa_messages', id}` —
never the text), and `src/lib/waLive.js` (`onWaLive`, `waLiveUp`; merge helpers in `src/lib/waMerge.js`, tested) fetches only what
is new (`GET /api/meta/chat-updates?since=<cursor>`) and hands it to every open screen: the chats tab (`GreenAPIChat`: the message
lands in its chat, a sent one replaces its optimistic bubble, the chat jumps to the top, a new chat is added), the Lead Center /
lead card (`LeadConversation`) and the admin (sidebar badge + a toast naming the lead outside the chats tab). The 8-second
history polls run only while the bus is down (once a minute otherwise); `chat-history` merges the stored rows over Green's
history (`mergeHistory()`), so a message is never lost even if Green's journal is. **As fast as WhatsApp** (2026-10-26):
a chat not opened in this session paints from our own table first (`chat-history {stored:true}` — `wa_messages` only, ~0.1 s)
while Green's full history (~4 s) is read behind it, and every Green read saves what the table missed (`historyToRow()` in
`lib/green-hook.js`, tested → `afik_wa_backfill(rows)`, `server/wa-backfill-migration.sql`: quiet — the change bus isn't told,
`updated_at` = the message's time, so the live feed never re-sends old messages), so the next open of that chat anywhere is
complete at once. Sending: the box clears the moment a text goes and stays open (the next message can go while the first is on
its way — only files and the very first welcome wait; a failure puts the text back), the bubble turns ✓ as soon as Green
accepts it and ✓✓ / blue arrive live; Green's history is re-read after a send only while the live feed is down. **Green's settings are checked by themselves:**
`greenSettingsCheck()` (10-min cache) re-enables the journals (`incomingWebhook`, `outgoingWebhook`, `outgoingMessageWebhook`,
`outgoingAPIMessageWebhook`) and points `webhookUrl` at us when either drifted (at most once an hour); `GET /api/meta/chat-settings`
reports it (`POST {fix:true}` fixes), `chat-status` returns `settings`; probe action `wa-fix`. The chatbot's hook point is
`handleGreenHook` (an incoming row = a question to answer until a person takes over).
**Messages written on the office phone are always in the history** (2026-11-01, `server/wa-catchup-migration.sql`, applied):
Green's webhook brings them as `outgoingMessageReceived` (`by_api = false`, ~2 s; 338 in the week before), and `auto-tick` /
`auto-run` also run `catchUpMessages()` (`lib/automations.js`): Green's `lastIncomingMessages` + `lastOutgoingMessages` of the last
3 hours → `afik_wa_catchup(rows)` inserts whatever a missed delivery left out — **announced** on the change bus (unlike the quiet
backfill), so open chats, the waiting list and the alerts get it like a live message. The automations count such a conversation:
`afik_wa_last(days)` (the newest message each way per phone) → `chatClock()` (`lib/automations-shared.js`, tested): the no-reply
step waits from our latest message wherever it was written (phone, panel or an automatic send), a reply Green's journal missed
stops the sequence, and a lead we already wrote to is never offered a "missed welcome".
**Reactions, like WhatsApp** (2026-10-26): a `reactionMessage` used to show as its own bubble with the word "reactionMessage" —
Green's history keeps the emoji in `extendedTextMessage.text` and the target in `quotedMessage.stanzaId`, which `slimGreenMsg`
dropped. Now `slimGreenMsg` (`api/meta.js`) and `rowToGreen()` / `mergeHistory()` (`lib/green-hook.js`; a stored row fills an empty
Green reaction) give `{ typeMessage: 'reactionMessage', textMessage: emoji, reactedTo }`, `normalizeGreenMsg` reads any of those
shapes, and `foldReactions()` (`src/lib/waMerge.js`, tested) puts each side's newest reaction on the message it reacts to (an empty
one takes it back): a small round chip under the bubble's corner in the chats tab (`GreenAPIChat`) and in the Lead Center / lead card
(`LeadConversation`, `.lcv-reacts`), the tooltip naming who reacted; a reaction to a message that isn't loaded shows as a quiet line
("תגובה 👍 · 03:21"). Alerts read "תגובה: 🙏" (`alertText()`).
**Message alerts** (2026-10-25): only messages that come in raise an alert — a message we send (by hand, a template, an automation, a stage message) never pops a card, a sound or a notification (the old "נשלח ל-…" / "נשלחה הודעה אוטומטית" toasts are gone; a failed send still shows). One place decides how the office hears about an incoming message, `notifyIncoming` in
`AdminPanel.jsx` (fed by the live feed and by the chats tab's fallback polls, deduped by message id; nothing for a message
older than 15 min or for a chat that is on screen in a focused window — `setViewing()` / `isViewing()` in `src/lib/waNotify.js`,
set by `GreenAPIChat` and every `LeadConversation`; that chat only gets a soft sound): a card per chat at the bottom-left
(`.msg-alert`: avatar, name, campaign, time, the message, "לפתיחת השיחה" (opens that exact chat — `setInitialChatLead`) /
"אחר כך"; more messages from the same lead merge into it, "N חדשות" — `mergeAlert()`; it stays while the window is in the
background, 25 s otherwise, paused on hover; "סגירת הכל"), a short WhatsApp-like sound (`playMessageSound`, not the new-lead chime),
an OS notification while the window is in the background (one per chat, tag `wa-<phone>`, a click opens the chat) and the browser
tab (`bumpTab`: "(N)" in the title, a red count on the icon, the title flashing "💬 name: message" until the window is back).
The chats tab's bell (`src/WaNotifySettings.jsx`) sets them (`localStorage.afik_wa_notify_v1`: sound / desktop / in-app card /
leads only), shows the browser's permission (ask / how to unblock) and sends a test alert (`afik:wa-test-alert`); an amber dot on
the bell while desktop notifications are off. **Resizable chats tab** (2026-10-26): the edge between the chat list and the conversation drags (`Splitter` axis x, the list
260–640 px, kept in `localStorage.afik_wa_list_w`; arrows / Home / End, double-click resets to 340; hidden on phones).
**A message's menu, like WhatsApp Web** (2026-11-01, `src/ChatMsgMenu.jsx`): every text bubble in the chats tab and in the Lead
Center / lead card (`LeadConversation`) has a ▾ at its top-left corner on hover (every bubble, ours and theirs; it fades into the bubble's color, `bg`, like WhatsApp Web, and the menu opens from there) (always faintly visible on touch screens): "העתקה" (the
clipboard, with an `execCommand` fallback) and "שמירה כתבנית" — `messageToTemplate()` (`lib/template-edit.js`, tested) turns the
lead's project and first name back into `{property}` / `{name}` (whole words only), and `TemplateQuickEdit` opens in `create` mode:
name (empty = `autoTitle()`: the project · the first words), category (default "אישי"), project (prefilled from `leadProperty()`,
kept on the template as `project`) and "להשתמש בה כהודעת הפתיחה הקבועה של <project>" (`rules.welcome.byProject`), saved as a new
template everywhere (chat, automations, bulk sends).
**Reply, react, forward, several at once** (2026-11-01, same menu; `lib/wa-actions.js`, tested): the menu opens with a row of
quick reactions (`chat-react` → Green `sendReaction`; the same emoji again takes it back, an optimistic chip at once), "השב" (a
quote bar above the box; `chat-send` / `messages` take `quotedMessageId` → `sendText(…, { quotedMessageId })`; with files only the
first one quotes), "העברה" and "בחירת הודעות" (checkboxes on the bubbles, a bar "N נבחרו · העברה", up to 30 messages — `FORWARD_MAX_MSGS`; 10 chats) → `ChatForward`
(`src/ChatForward.jsx`: every chat / lead with search, a typed number too, up to 10 chats → `POST /api/meta/chat-forward
{ from, to, ids }` = Green `forwardMessages` per chat, 0.7 s apart, a result per chat, stops at a 466). The Lead Center / lead
card list the admin's leads through `src/lib/leadsStore.js` (`setSharedLeads` / `useSharedLeads`).
**Property messages with files** (2026-11-01): a template can carry `project` (its property — set when saving a message as a
template, in the chat's quick editor or in the templates tab) and `files` (`[{ url, name, type, size }]`, ≤ 30, `templateFiles()`
in `lib/automations-shared.js`; picked / dropped / pasted in `src/TemplateFilesField.jsx`, uploaded by the browser to
`property-media/templates/…`). "הצעות" puts the lead's property's templates first (with a 📎 count) and has "הודעות נכסים" — every
property's templates grouped by property, "לתיבה" / "שלח". A template with files puts them in the tray (`useAttachments().addRemote`,
already in storage — no upload, no video byte before sending; its picture joins them first, `templateAttachments()`); sent as is
from the chips / menu / window they go after the text (`sendFiles` takes `{ url, name }` items). Automatic sends still carry only
the picture.
**Template names and projects** (2026-11-01, `lib/template-edit.js` `knownProjects()` / `titleIdeas()` / `autoTitle()`, tested): the
templates tab's editor opens with "פרטי התבנית" — the category as colored chips (no native select), "פרויקט / קבוצה" (any name typed,
or a chip of the projects the templates and leads already have) and the name in Hebrew + English with "הצעות לשם" (`<category> ·
<project>`, `<project> · <first words>`, the first words — never a name already taken, a number added); saving without a name takes
the first idea. The library has a "פרויקטים:" filter row and a project / 📎 badge per card; a new template from a project filter
starts in that project. The chat's quick editor has the same chips and ideas.
**"Handled" — off "ממתינים לתשובה" by hand** (2026-11-01, `lib/wa-actions.js` `isHandled` / `withHandled` / `withoutHandled`, tested):
a ✓ on every waiting row in the chats list (on hover; always faint on touch), "✓ טופל · ממתין N" in the open chat's header, and in
the waiting filter "בחירה" → checkboxes, "בחירת הכל", "✓ טופל (N)"; an undo bar "הוסרו N · בטל" for 9 s. `markHandled()` /
`unmarkHandled()` (`src/lib/waWaiting.js`) drop it at once on every screen (board chips, Lead Center, the sidebar count) and save
`POST /api/meta/chat-waiting-done { items: [{ phone, ts }] | undo: [phones] }` → `app_settings.wa_waiting_done` (last 9 digits →
the lead's last message time; 60 days); `chat-waiting` leaves those out and returns `done`. The chat waits again as soon as the lead
writes something newer.
**WhatsApp's own ticks** (`TickMark` in `src/waShared.jsx`): the SVG shapes WhatsApp Web draws — one check = sent, two = delivered,
two in `#53BDEB` = read (or played) — in the chats tab, its list and the Lead Center / lead card; a clock while sending, "!" failed.
**The chat list** has filters "הכל · לא נקראו · ממתינים לתשובה" (counts;
`sessionStorage.afik_wa_filter`), unread rows tinted with a green count, and a chip on every chat whose last word is the lead's
("ממתין 25 דק׳" — green < 10 min ≤ amber < 60 min ≤ red; the waiting filter puts the longest wait first) — pure helpers
`lastOfChat()` / `waitingState()` / `fmtWait()` / `alertText()` / `mergeAlert()` in `src/lib/waInbox.js` (tested).
**"ממתינים לתשובה" everywhere** (2026-11-01): a lead whose WhatsApp chat ends with their message (reactions don't count) is marked
on the leads board — a chip on the pipeline card, after the name in the table and on the phone card ("ממתין 5 דק׳", green < 10 min ≤
amber < 60 min ≤ red; a click opens the chat; the tooltip quotes their message) — and on the Lead Center's list rows (`src/WaitingChip.jsx`);
the board's header has "ממתינים לתשובה N" (shows only them, `onlyWaiting`) and the sidebar's chats item an amber "⏱ N". One source:
`public.afik_wa_waiting(days)` (`server/wa-waiting-migration.sql`, applied 2026-11-01: the newest message per phone in `wa_messages`
is incoming) → `GET /api/meta/chat-waiting` (the office's own number left out) → `src/lib/waWaiting.js` (`useWaiting()` /
`waitingOf()`): read once, then kept fresh by the live feed (`applyWaiting()` in `src/lib/waInbox.js`, tested: a message in marks
the chat, ours clears it) and re-read when the window comes back after a minute.
**Profile pictures** (2026-10-25): every face in the chats list and header, the Lead Center (list, lead header and its Pipeline /
table / drawer — `MetaKanban`), the leads board (pipeline cards, table name column, mobile cards, drawer, call summary, trash list),
the lead card's header and conversation, the automations' "היום" rows, the admin home's recent leads (no zoom there — the row is a
button) and the message alert card shows the person's WhatsApp profile picture over the initials (`src/WaFace.jsx`:
asked for only once on screen — IntersectionObserver; the initials stay when there is none or it fails to load). `src/lib/waAvatars.js`
gathers the asks for 120 ms → `POST /api/meta/chat-avatars {phones}` (≤ 40, Green `getAvatar` 3 at a time within ~18 s; a number
not answered in time is asked again a minute later) and keeps the answers in memory + `localStorage.afik_wa_avatars_v1` until the
link expires. The server caches them in `wa_avatars` (`server/wa-avatars-migration.sql`: phone, url, available, expires_at from
WhatsApp's `oe` link parameter, checked_at; RLS on) — a picture until an hour before its link expires (≤ 3 days), "no picture" for
a day (`lib/wa-avatar.js` `avatarExpiry` / `avatarFresh` / `avatarPhone`, tested). The images load straight from WhatsApp's CDN
(`referrerPolicy="no-referrer"`), never through a function. The probe's `wa` action reports counts only.
**Pictures from every channel** (2026-11-03): a face with no WhatsApp picture shows the person's Messenger / Instagram one —
`chat-avatars` takes `{ phones, social: [thread ids], refresh: [keys] }` and answers `{ avatars, from: { key: whatsapp | messenger |
instagram }, links: { key: profile url } }`: WhatsApp first (as before), then `socialAvatars()` (`api/meta.js`) looks in
`social_threads` for the thread with that phone or with that CRM lead (`lead_id`, through `leadIdsByPhone()`), and for the thread
ids asked for directly (a lead made from a Messenger / Instagram chat, `crm_data.social.threadId` — `leadSocialKey()`); an expired
Meta link (`socialAvatarFresh()`, `avatarExpiry` reads `oe` hex and Messenger's `ext`) or a key the browser reports broken is
re-read from the Graph (`socialProfile`, ≤ 6 per call) and saved back on the thread. `WaFace` takes `lead={lead}` (every board /
card / follow-up / alert / home face passes it) or `social=<thread id>` + `seed` (the inbox's Meta faces go through it too), asks
both keys, prefers the number's picture (`pickFace()`, `lib/wa-avatar.js`, tested), sets `data-face-src`, and the viewer says
where the picture is from ("מסנג׳ר · 050-…"), with "לפרופיל" (Instagram) / "פתיחה בוואטסאפ". Browser cache key `afik_wa_avatars_v2`
(`{ u, s, l, x }`). A Meta lead-ads lead has no Facebook profile to read — its picture comes only from a chat (WhatsApp / Messenger /
Instagram) with the same number.
**A click on a face that has a picture opens it big** (`FaceViewer` in `src/WaFace.jsx`, a portal): the original file WhatsApp keeps
(usually 640×640, its size shown), as big as the screen allows but never more than twice its own size, with the name, the phone,
"פתיחת המקור" (a new tab) and ✕ / Esc / a click outside; the face is a `role="button"` (Enter / Space) and its click never reaches the
row, card or drag under it.
**Green API plan quota (466):** the free / Developer plan answers `466 "Monthly quota has been exceeded"` to every number
outside its few allowed chats while `getStateInstance` still says `authorized` ("connected, but nothing goes out" — every welcome
failed from 2026-10-11 until the plan is upgraded at console.green-api.com). `sendText` (`lib/automations.js`, also used by the
chat page's `chat-send`) remembers it in `app_settings.green_quota` (`greenQuota()` / `parseQuota()` / `quotaPaused()`, tested):
automatic sends pause for an hour after a refusal (then one send probes again), a refusal doesn't use up one of a lead's 3 tries,
and the first successful send clears the flag. `auto-health` and `chat-status` return `quota`; the automations header says
"לא שולח" with an upgrade banner, the WhatsApp page shows "מחובר · השליחה חסומה (מכסה)" + a banner, and a failed send shows
Green's real reason. A 429 (Green's per-second rate limit — the panel asks several things at once) is retried (`greenFetch`).
**Missed welcomes:** a lead whose welcome never went out (`auto.welcomeFailed`, or a Meta lead whose `meta:<id>` welcome failed in
`automation_log`) is offered in "היום" as `welcome:missed` ("הודעת פתיחה שלא נשלחה", `missedWelcome()`, tested) for 21 days, in any
rule mode; sending it counts as the welcome. The no-reply sequence starts only after a message actually reached the lead.
**{property}** in templates = `leadProperty()`: the short campaign name for Meta leads ("זרובבל 15", via `shortCampaign`), the
listing title for website leads. **"היום" layout:** KPI row (sending window · awaiting approval · sent · positive · failed), the
approval queue grouped by kind (missed welcome first, "send all N" per group, stops at the first quota refusal), compact rows
(lead + campaign + local phone + reason · the full message · send / skip / chat), then the schedule. **Renaming from "היום":** a click on a row's name opens an inline editor (Enter / Esc, "+ הוספת הפרויקט: <short campaign>") → the admin's `updateLead(id, { name })` (`onRenameLead`) = the same rename as the board (CRM, `meta_leads`, the chats, the open Lead Center); every row of that lead shows the new name at once and a message not edited by hand is re-rendered with it. **Wording per message:** a
template dropdown above every message (the item's category first, the whole library below — rendered for that lead in the
browser with `renderTemplate`), "נוסח אחר" (next template of the same category), "ערוך הודעה" (free edit), "שחזר נוסח"; the
group header has "נוסח לכל הקבוצה…". The send carries the chosen `templateId`. The built-in library has 77 bilingual templates
(welcome / late-welcome / investor / scheduling variants, follow-ups, visits, after-call, nurture, re-engagement, chat-ready
replies, deal steps; **"מתעניין – אחרי שיחה וחומרים"** (`cat: 'interested'`, 10 `int_*` templates, 2026-10-26): a lead who got the
materials after a good call — did you go over them, is there a direction or not ("גם "לא" זו תשובה טובה"), a call with the
developer, a meeting at our office, which of the two, what is still open, a few days later, who else decides, things are moving,
pick a time; the stage "מתעניין" (`discovery`) recommends them first and its stage message defaults to `int_checkin`; **"נוצר קשר"**
(`cat: 'contacted'`: `after_call`, `send_details` + 4 `ct_*` — the materials as discussed, narrowing down what they need, picking
up the conversation, thanks for the call); **"לא ענה" rewritten** (2026-10-26, every one aims at a call or a meeting, like a
person texting — "רק מוודאים שההודעה שלנו על זרובבל 15 לא נקברה אצלכם. יש מצב ל-5 דקות טלפון מחר?", the plans are ready, we tried
to catch you, phone or WhatsApp, still on the table ("גם 'לא כרגע' זו תשובה טובה"), things are moving, two concrete times, a
weekend opener, the last message without a team signature) + `nr_meeting` (half an hour at our office) and `nr_book` (the
booking link)), **written by people, from the Afik Hanahal page**: always plural — the office is "we" ("ראינו",
"נשמח", "נתקשר") and the lead is addressed in plural ("השארתם", "לכם", "אתכם"), which also keeps the Hebrew gender-neutral; the
message opens with **why we write and what the lead asked about** — the project / listing (`{property}`; `{when}` / `{where}` and what they look for, `{needs}`, live in the longer templates — the welcome stays one short line) — not with the office: "היי רונן, ראינו את הפנייה על זרובבל 15.\nלשלוח תוכניות ומחירים, או שנדבר בטלפון?" (**a project can have a welcome of its own** — `rules.welcome.byProject` `{ "<project's short name>": templateId }`, set in the welcome rule's card ("+ הודעת פתיחה משלו לפרויקט…", the projects the leads came from), matched by `sameProject()` with `leadProperty()`, so a project's picture only ever goes to its own leads; since 2026-10-30 "זרובבל 15" gets "פתיחה – קצר ולעניין - זרובבל 15 (עותק)": "היי {name}, קיבלנו את הפרטים על זרובבל 15. נוח שנתקשר היום?" + the project's picture; any other lead whose project / listing we know — a Meta lead's campaign counts — gets the rule's project welcome, `welcome_prop`, through `welcomeTemplateId()` in `lib/automations-shared.js`: the automatic send, the Lead Center's first text and the missed-welcome queue; it never names the office — the project says who we are). "אפיק הנחל" appears in at most 4 templates (a first message without a project, a late one, the months-later re-engagement, the review request), once, never as the opening words (test "every message is about the lead"); `{property}` / `{needs}` sit inside `[[ … ]]` wherever the sentence reads fine without them, so a lead with no project gets no generic "הנכס"; the lead analysis' suggested message (`lib/lead-analyze.js`) follows the same rules; later ones carry no signature (`{agent}`, default
"צוות אפיק הנחל", only signs the closing / holiday messages, inside `[[ … ]]` so an empty value drops the line); "היי" (or `{greeting}`: `timeGreeting()` = בוקר טוב / צהריים טובים / ערב טוב by the Israel hour, rendered at send
time) instead of "שלום … תודה על פנייתך"; the welcome says what a person would know — `{when}` (`leadWhen()`: היום / אתמול /
ביום שלישי, '' after a week) and `{where}` (`leadWhere()`: במודעה for Meta leads, באתר for website forms) — "ראיתי שהשארת פרטים
אתמול במודעה על זרובבל 15. אפשר להתקשר אליך לכמה דקות?"; 1–3 short lines, one concrete question ("היום אחר הצהריים או מחר
בבוקר?" rather than "מתי נוח?"), everyday words ("סגור", "בא לך", "יש מצב"), commas instead of typographic dashes, sentences
instead of bullet lists; no slashes, no
gendered present-tense or imperatives; no childish emoji. A test fails if singular wording comes back
("ראיתי", "אשמח", "לך", "השארת"… or "I" in English), if 👋 🙂 🙌 🎉 🙏 🔥, "–" or "•", bot
phrases ("נשמח לעמוד לרשות", "פנייתך", "צוות אפיק הנחל", "We would be glad", "Dear "…), a team signature block or a Hebrew text
over 110 characters (a first message: 100), or more than 2 lines, come back — the library was cut down on 2026-10-23 and again on 2026-10-25
(the welcome is one short line + one question: "היי אדי, ראינו את הפנייה על זרובבל 15.\nלשלוח תוכניות ומחירים, או שנדבר בטלפון?"; what the lead looks for
waits for the personal templates). **English messages** (rewritten 2026-10-24 in natural, professional English — "thanks for leaving your details", "Would you
like us to send…", "Tabu registration", "the Sharon region") **never carry a Hebrew word**: `lib/english-values.js` (tested — a test
renders all 77 templates in English for a Hebrew lead and fails on any Hebrew letter) writes the project in English
(`englishProject`: "זרובבל 15 - v2" → "15 Zerubavel Street", from a street / town list — add a new project's street there), the
form answers (`englishValue`: "5 מיליון ומעלה" → "₪5 million+", "3 חדרים" → "3 rooms", "פנטהאוז" → "a penthouse", towns), and
the name (the one typed in the form, else the Hebrew first name in English — `latinFirstName()` — else "Hi there"); a value it
can't write in English is left out (its `[[ … ]]` part drops). **Names:** a Hebrew message writes an English first name in Hebrew
(`lib/hebrew-names.js` `hebrewFirstName`, a list of ~450 Israeli names; "Ronen" → "רונן"); an unknown Latin name is left out
("שלום,") rather than guessed. `renderTemplate` closes the gap an empty placeholder leaves ("שלום ," → "שלום,"). The Lead Center's
quick replies use the same rules and the campaign's short name.
**Files in every chat, like WhatsApp** (2026-10-24): the chats tab (`ChatComposer` / `GreenAPIChat`), the Lead Center and the
lead card (`LeadConversation`) take photos, videos, PDF, Word / Excel and more — several at once (up to 30, 50 MB each — `MAX_FILES`), from
the paperclip ("צירוף"), dragged onto the conversation ("שחררו כאן") or pasted into the box. `src/ChatAttachments.jsx`
(`useAttachments`, `AttachTray` — thumbnails / file icons, size, ✕, per-file status —, `useFileDrop`, `DropOverlay`,
`pasteFiles`) + `src/lib/chatFiles.js` (tested: `acceptFiles`, `fileProblem`, `sendFiles`): every file is uploaded by the
browser straight to Supabase Storage (`wizard-upload-url`, `folder: 'chat'`, kinds image / video / pdf / doc → `property-media/
chat/<month>/…`; photos compressed to ≤ 1600 px JPEG first) — never through a Vercel function, so no 3 MB cap — and sent by URL:
`chat-send` / `messages` take `{ file, fileName }` → `sendText(…, { file, fileName })` → Green's `sendFileByUrl` with the original
name (`mediaFileName()`); the text is the first file's caption, then the rest; a failure keeps the unsent files in the tray. In
the Lead Center the very first message (the welcome) goes as text first, then the files.
**One group, like a WhatsApp album** (2026-11-02): the tray puts photos and videos first (`mediaFirst()`), every file is uploaded
first, 3 at a time (`uploadAll()`), then **one** request sends them back to back — `POST /api/meta/chat-send-files { phone, caption,
items: [{ file, fileName }], quotedMessageId? }` (`fileGroupRequest()` in `lib/wa-actions.js`, tested: https links only, ≤ 30) →
`sendText` per file, the text as the first one's caption, stops at the first failure / 466; near the function's time limit it answers
`partial` and `sendGroupRequest()` (`src/lib/chatFiles.js`, tested) sends the rest. The tray's header says "N קבצים · יישלחו יחד ·
M תמונות וסרטונים כאלבום אחד". **"שמירה לתבנית"** (the tray's header, `src/SaveFilesToTemplate.jsx`): the attached files are
uploaded to `property-media/templates/…` and added to a template the office picks (the lead's project's templates first, search;
`addFilesToTemplate()` in `lib/template-edit.js`, tested: after its own, no link twice, ≤ 30) or open a new template in the quick
editor with them and the box's text — so a property's regular set of photos / price list goes out again in one click.
**A picture per template** (optional): a template's `image` (an https URL; `templateImage()` / `isImageUrl()` in
`lib/automations-shared.js`) is sent as a WhatsApp image with the text as its caption — `sendText(phone, text, { image })`
(`lib/automations.js`) switches to Green's `sendFileByUrl` (`urlFile`, `fileName` from the URL, `caption`). Every path carries
it: the automatic welcome (`welcomeFor` → `image`), stage / no-reply / re-engagement sends, the approval queue (`suggestions` /
`upcoming` items have `image`; `sendItems` takes `it.image`, else the template's own by `templateId`), bulk jobs, the
templates tab's test send (`auto-test {image}`), the chat (`chat-send {image}`) and the Lead Center (`messages {image}`,
`lead-welcome {image}` — `''` = without it). The picture is picked, dropped or pasted in `src/TemplateImageField.jsx` (the
templates tab's editor and the chat's quick editor), compressed in the browser to ≤ 1280 px JPEG and uploaded through
`wizard-upload-url` with `folder: 'templates'` (`property-media/templates/…`, 1-year cache; `src/lib/templateImage.js`, previews
always through wsrv.nl `imageThumb()`); `withTemplate()` keeps it. The phone preview, the library cards ("עם תמונה"), the "היום"
rows, the ⚡ panel, the header menu and the Lead Center's quick replies show it; a template put in the box brings its picture
as a chip ("תמונה מהתבנית", ✕ = send without it).
**Categories in the pipeline's order, opened on the lead's stage** (2026-10-26): `CATEGORIES` (`lib/automations-shared.js`) runs
פתיחה · נוצר קשר · מתעניין · רוצה להתקדם · לא ענה · אישי · עסקה · לא מעוניין · כללי (`short` / `en_short` = the button labels), and
`stageCategory(lead, { hasOut, hasIn })` (tested) says which one fits now: nothing sent → פתיחה; a new lead who got our message and
never answered → לא ענה; new + replied → נוצר קשר; contacted → נוצר קשר; discovery → מתעניין; meeting / negotiating → רוצה להתקדם;
won → עסקה; lost ("ללא מענה") → לא ענה; irrelevant / nurture → לא מעוניין. Every templates window has a button per category (with
counts, wrapped — never a hidden scroll; the stage's button is marked "השלב") and **opens on the stage's category**: the Lead
Center / lead card quick window (`.lcv-qcats`, then "הכל"), the chats tab's window (`ChatTemplatePicker`, chips / side column,
then "מומלץ" and "הכל"); the header menu puts the stage's category right after "מומלץ", then the pipeline's order. The search
always looks through the whole library.
**"קשר אחרון" on the lead card** (2026-10-26): at the end of the card's tab row, a pill with the last time we were in touch —
`lastContact(lead, chat)` / `lastContactText()` (`src/lib/leadFields.js`, tested): the open conversation's newest message
(`LeadConversation` `onActivity` now also reports `lastAt` / `lastDir`), call / meeting / WhatsApp notes and their outcome
("ניסינו להתקשר"), `lastCallAt`, automatic sends and the lead's reply — "קשר אחרון: 26 באוק׳, 11:52 (היום) · שלחנו בוואטסאפ" (always
the date, then how long ago); with no contact at all "קשר אחרון: עוד לא נוצר קשר · הליד נכנס לפני 4 ימים"; green under 3 days, amber
under 7, red after; the full date in the tooltip. A plain note doesn't count as contact. **The card's conversation column drags**
(its inner edge, `Splitter` → `--lc-conv`, 360–1100 px, `localStorage.afik_lead_card_conv_w`; double-click resets to 40 %).
**One template library everywhere** (2026-10-26, `src/lib/autoConfigStore.js`): the admin's `autoCfg` is published to every screen
(`setSharedAutoConfig` / `useSharedAutoConfig`) and any save comes back to it — the automations tab, the chats (window, menu,
"הצעות", quick editor), the Lead Center and the lead card (it used to keep its own copy, read once per session) all show the same
wording at once. The admin re-reads the config when its window is back in focus (≥ 30 s apart), so an edit from another device
arrives too. The automations tab re-syncs whatever is saved (unsaved rule edits stay in the draft) and every save there starts from
the server's current config (`fresh()`), so it never overwrites a template saved from a chat a moment ago. A template change
re-renders the "היום" queue on the server right away (`runAutomations` 1.5 s later), and the server's config cache is 5 s
(`loadConfig`), so the next automatic send uses the new wording.
**Sending in the chat** (messaging UI v2, 2026-10-23 — line icons from `src/uiIcons.jsx` (`Icon`, `CatTile` per template
category), never emoji in the UI chrome): **the message box** is `src/ChatComposer.jsx` (GreenAPIChat keeps the state) — one card
with the "מתבנית · <title>" line (changed → "שמירה בתבנית", ✕ clears the box), the attachment or the template's picture, the
text (grows; Enter sends, Shift+Enter = new line; the placeholder names the lead) and a toolbar: emoji · attach · "תבניות" … a
labelled green "שלח" / "שלח עם תמונה" (icon-only on phones). **"הצעות"** over the empty box (`ChatQuickChips` in
`src/ChatTemplatePicker.jsx`: the 3–4 templates that fit this lead now — the most personal one + the stage's category): a click
puts one in the box, the round button sends it. "כל התבניות" sits first, right after the label (on the right in Hebrew). **The templates window** (`ChatTemplatePicker`): categories (a side column when
≥ 860 px wide, chips otherwise) · the list · a WhatsApp preview of the selected message for this lead (editable in the bubble, its
picture can be left out) with "שלח עכשיו" and "הכנס לתיבה"; it opens on the best message for the lead, ↑ / ↓ move, Enter = to the
box, Ctrl+Enter = send, Esc; narrow screens show the list, then the preview with a back button. The header's "תבניות ▾"
(`ChatTemplateMenu`, hidden on phones — the composer has the button) has "שלח" on the active row. The Lead Center's composer
(`LeadConversation.jsx`) is the same card: template line, picture, full-width text, toolbar with "תבניות" and a labelled send
("שלח הודעת פתיחה" before the first message). Library cards in the templates tab are WhatsApp bubbles (light `#D9FDD3` in the light admin theme — `.au-wa-bub`).
**Personal templates** (category "אישי – לפי הפנייה"): `lib/lead-needs.js` `leadNeeds()` (tested) reads what the lead told us —
the lead card's fields (budget / rooms / area / timeline / dealType / propertyType) over the Meta form answers (matched by the
question's wording) and, for website leads only, the first sentence they typed — into `{needs}` ("4 חדרים, בכפר סבא, בתקציב של
3–4 מיליון"), `{budget}`, `{rooms}`, `{area}`, `{timeline}`, `{purpose}`, `{message}`. A `[[ … ]]` part of a template is kept only
when every placeholder in it is known, so one template works with or without the data; a fallback after a Hebrew prefix drops
its ה ("בנכס", never "בהנכס"). Six templates (`personal_needs` / `_budget` / `_message` / `_investor` / `_timeline` / `_followup`);
in "היום" every row shows "מה ידוע:" and a "✍️ התאמה אישית" button (`bestPersonalTemplateId()`), and the group menu has
"הכי אישי לכל ליד".
**WhatsApp page → ⚡ "תבניות מוכנות"** (`src/ChatTemplatePicker.jsx`): the whole library (77 templates, incl. chat-ready ones —
details, viewing offer / directions / feedback, financing, similar / new listings, price update, busy-now, office hours, owner
valuation, signing steps, contract documents, keys, review / referral requests) rendered for the open chat's lead (the lead row
from `leads`, so names, the campaign's short name and `leadNeeds` all apply), "מומלץ עכשיו" (the most personal template + the
stage's category, the welcome category before anything was sent), category chips, search, a Hebrew / English switch (default
`leadLang`), an editable preview, "שלח עכשיו" (`sendMsg(text)` — the panel stays open, so several go out in a row; the typed draft
and attachment are untouched) or "לעריכה בתיבה". Templates whose distinctive line already appears in the chat are marked "נשלח".
**Editing a template from the chat** (`src/TemplateQuickEdit.jsx`): "✏️ ערוך" on every row of the dropdown and in the ⚡ panel
opens the template itself (placeholders kept, variable chips, a live preview for the open chat's lead, Hebrew / English) →
"שמור במקום התבנית" (replaces it everywhere: chat, automations, bulk sends), "שמור כתבנית חדשה", or "שחזר לנוסח המקורי" for an
edited built-in. Saving re-reads `auto-config` first, writes `config.templates[id]` (`lib/template-edit.js` `withTemplate` /
`withoutOverride`, tested) and hands the new config up (`onAutoConfigSaved` → the admin's `autoCfg`). **From the message box:** a
template put in the box is remembered; once its text changes a bar offers "שמור במקום התבנית" — `untemplate()` aligns the edited
text with the render marked by `renderTemplate(…, { keys: true })` (`\uE000key\uE002value\uE001`) and turns every lead value
that survived the edit back into its placeholder ("אמיר" → `{name}`, "זרובבל 15" → `{property}`), then opens the editor to
confirm.
The chat header has the same library as a dropdown, **"⚡ תבניות ▾"** (`ChatTemplateMenu`, same file, same `useTemplateData`):
search, Hebrew / English, "מומלץ לליד הזה", the personal templates, then every category; a click puts the message in the box
(cursor at the end) to review and send, the row's "שלח" sends it as is; ↑ / ↓ / Enter / Esc; a fixed-position popover clamped
to the window; the footer opens the full ⚡ panel. Both render for `chatLead` (one memoized lead row per open chat).
Probe actions `wa` / `wa-send` check the chat page's own calls (`wa-send` texts the office number).

Scheduled bulk sends are jobs in `app_settings` (`automations_jobs`), rendered at send time. **Paced so WhatsApp doesn't block the
number** (2026-11-01 — it used to send 20 at once, 0.5 s apart): one message per tick for the whole line, then `nextAt` = a random
gap (`gapSec` 45 s / 1 min / 2 min / 5 min ±25 %, `paceGapMs()`), at most `dailyCap` (30 / 60 / 100 / 200) a day (`sentTodayCount()`,
then `nextAt` = the next day's sending window), only in sending hours (`respectQuiet`, now on for "send now" too), a lead who wrote to
us after the job was created is skipped ("ענו לנו בינתיים", `repliedSince()`, `skipReplied`), a 466 quota refusal leaves the
recipient pending and waits an hour; each recipient's lead is read on its own (`getLead`), never the whole list. Pure rules in
`lib/automations-shared.js` (tested, `lib/bulk-pace.test.mjs`; the engine end to end in `lib/bulk-jobs.test.mjs`). **The database
drives it:** pg_cron `afik-bulk-jobs` (every minute, `server/bulk-pace-migration.sql`) counts the due jobs (`public.afik_due_jobs()`:
status scheduled / sending, `at` and `nextAt` passed) and only then calls `auto-jobs-tick` with the database-made `remind_key`, so a
send keeps going with the panel closed and nothing is called at night or after the cap; the open bulk-sends tab nudges every 30 s.
The wizard (`src/CampaignsTab.jsx`): stage chips with counts ("ללא מענה" included), "רק מי שעוד לא ענה לנו" (`states[id].replied`;
a "ענה לנו" badge per row), then "קצב שליחה" (gap, daily cap, an estimate — `paceEstimate()`), the skip-replied switch and the
safety tips; the job card shows the pace, "ההודעה הבאה …", "הגיע למכסה היומית" and how many were skipped because they replied.
**A/B test** (2026-11-01): the wizard's first step is a full-window screen (`Modal xl`) — the template list scrolls on its own
(search, category chips with counts, each row shows its opening words) and the WhatsApp preview stays in view; "A/B טסט: כמה
נוסחים" picks 2–4 versions (A–D tiles, preview tabs per version; editing the text for one send works with one version only).
The recipients are shuffled and dealt out in turn (`abSplit()`), each keeps its `variant`, the job carries `templateIds`, and
the engine sends every recipient its own version (`ruleKey tpl:<version>`). Every job card shows **results** (`AbResults`,
`abResults()`: sent · replied after their message — `lastInboundTs` > the send · positive · opted out / negative · reply rate as
a bar), per version for an A/B; "מוביל" only once every version has ≥ `AB_MIN_SAMPLE` (15) sends, and a note when the gap is
under 5 points. Tested in `lib/bulk-pace.test.mjs` / `lib/bulk-jobs.test.mjs`.
**From the leads board:** select leads (cards or table) → "שליחה מרובה בוואטסאפ" in the bulk bar (`afik:bulk-send` window event →
`AdminPanel` `bulkIds` → the automations tab's bulk sends, a new wizard with them already picked — only them are listed until a
filter is used). `auto-tick?key=` (key = `AUTOMATION_KEY`, or the admin token)
lets an external pinger such as cron-job.org run the engine every 5 minutes, so timing is exact even with the panel closed.
Sending hours are `[start, end)` per weekday in 0.5-hour steps (Israel time); welcome, replies and stage messages ignore them.

## Inbox — WhatsApp + Messenger + Instagram of every page → leads (admin "תיבת הודעות", `/admin-panel/social`)

(2026-11-03) `src/SocialInboxTab.jsx` + `api/meta.js` `handleSocial` / `storeThreadBatch` / `storeSocialEvents` / `syncSocialStep` /
`waImportStep` + the pure, tested `lib/social-hook.js`; tables `social_threads` / `social_messages` (`server/social-migration.sql`: RLS
on, service key only, `social_threads` announced on the change bus) and `public.afik_wa_threads(lim)` (`server/social-inbox-migration.sql`,
applied: one row per phone of `wa_messages` — the newest message, count, how many of theirs came after our last). **One list for
every channel, newest first, "הכל" open by default**: the office's WhatsApp line (`GET social-wa`: named from the CRM lead / phone
book in proper Hebrew, linked to the lead by the last 9 digits — `leadIdsByPhone()`, 2-min cache) and Messenger / Instagram of
**every page in the inbox** — the leads' pages (`META_PAGE_IDS`, always) + any page switched on in "חשבונות מחוברים"
(`app_settings.social_pages` `[{ id, name, on, ig }]`, `cleanSocialPages` / `inboxPageIds` / `accountLabels`; `POST social-page
{id, name, on}` also subscribes the page to `messages`). The webhook (`/api/meta/webhook`, `object: 'page'` messaging and `object:
'instagram'`) keeps only inbox pages; leads (`leadgen`) still only from `META_PAGE_IDS`. Names show in proper Hebrew (`name_he` =
`hebrewFullName`, the stored name stays as Meta gave it). **Unread is obvious:** a row whose last word is the person's (a Meta
thread's `unread`, a WhatsApp chat's `waiting`) is bold with a green count and an accent bar, "לא נקראו" is a filter (with its count
in green), and the conversation draws a "N הודעות חדשות" line before them (`unreadCount` in `LeadConversation`; `social-thread`
returns the count it just cleared and sends Messenger `mark_seen`); "סימון כלא נקרא" (`social-unread`) makes the row bold again.
The list: search, filters (הכל · לא נקראו · עוד לא ליד · וואטסאפ · מסנג׳ר · אינסטגרם), a chip per page, each row with the channel's
icon on the face and "where" (the page / קו המשרד). **A WhatsApp chat is the real WhatsApp conversation** — `LeadConversation`
(`hideHeader`; the CRM lead or a stand-in for a number that isn't one): reply with a quote, reactions, forward, select several,
save as a template, emoji, templates, files, ticks, live updates. **A Messenger / Instagram chat**: the same ▾ menu on every bubble
(`ChatMsgMenu`: copy, save as a template → `TemplateQuickEdit`, forward → `InboxForward` = the text to up to 10 conversations of any
channel, a typed number too; Instagram also ❤️ — `social-react`, Meta's API knows only "love" and nothing on Messenger), an emoji
grid (`EMOJI` from `ChatComposer`), templates (`ChatTemplateMenu` in the header, `ChatQuickChips` over an empty box, the full
`ChatTemplatePicker` window — rendered for the CRM lead or a stand-in; the text only), a reply box (`social-send`, past 24 h the
`HUMAN_AGENT` tag). Both: the face opens big (`FaceViewer`, exported from `src/WaFace.jsx`, with a profile link), the name links
to the person's profile (`profileLink()`: wa.me · instagram.com/@handle · the chat in Meta Business Suite — Meta never gives a
Messenger profile address); **a click on the name edits it** (`ChatNameEdit` with `onRename`: a WhatsApp chat → the CRM lead's
`updateLead` or `chat-contact-name`; a Meta thread → `social-rename`, which also renames its lead) with "+ הוספת הפרויקט"; **the
lead's tools row** (`.si-tools`, for a chat whose person is a CRM lead): the stage pill menu (`StageMenu`), the **project chip with its
dropdown** (`ProjectChip` — pick, search or create), follow-up, notes, AI summary, "כרטיס הליד"; **"לא ענו לנו"**: a chat whose last
message is ours for over an hour carries "לא ענו · 2 ימים" (row chip + the tools row) and has its own filter; **delete**: the ⋯ menu
deletes a Meta conversation (`social-delete`, its messages with it; the lead stays) or **hides** a WhatsApp chat from the inbox
(`social-wa-hide` → `app_settings.wa_hidden_chats`; the "מוסתרות" filter shows them, "החזרה לתיבה" brings one back), A− / % / A+ and Ctrl / ⌘ + wheel zoom the chat (`--si-z`, `localStorage.afik_inbox_zoom`), the list's
edge drags (`Splitter`, `afik_inbox_list_w`), and **"הוסף כליד"** (name, phone / email, stage, **project / property — pick, search
or create** (`ProjectSelect`), a note → `social-to-lead` / `social-wa-lead` (`manualLeadRow` with `channel: 'whatsapp'` → source
`whatsapp`; a phone already a lead opens that lead), the last 8 messages as the first note). **"חשבונות מחוברים" = the one-stop
shop:** summary pills, the pages in the inbox (picture, Messenger status with "חיבור להודעות", the linked Instagram, how many
conversations, "הסרה מהתיבה"), **"עמודים שאפשר להוסיף"** — every page the System User reaches that isn't in yet, "+ הוספה לתיבה"
(`/me/accounts` in `social-status` → `available`), a 3-step guide with links for a page not listed (Pages → Add / Request access;
System users → afik-api → Assign assets → Full control; רענון), the WhatsApp line, and **the whole history imported in steps** (one
call ~40 s, the browser carries the cursor, progress + stop): `social-sync {cursor}` — every inbox page × Messenger / Instagram,
25 conversations per Graph page × their last 100 messages (`conversationEvents` + `threadRowFrom`, 3 queries per conversation,
names from the participants, a missing name / picture filled later); `social-wa-import {cursor}` — Green `getChats` →
`getChatHistory` 100 per chat → `afik_wa_backfill` (quiet). **Setup on Meta's side (once):** a System User token with
`pages_messaging`, `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata` (+ the leads scopes) in
`META_SYSTEM_USER_TOKEN`, App Review for the messaging permissions, the Instagram object subscribed to `messages` in the app's
Webhooks, and on the phone Instagram → messages → "Allow access to messages".

## Documents & digital signatures (admin "מסמכים וחתימות", `/admin-panel/documents`; the client's page `/sign/<token>`)

(2026-11-03) The office's brokerage-order form ("טופס הזמנת שירותי תיווך", אפיק הנחל יזום, שיווק, תיווך נדל"ן בע"מ, ח.פ. 517082038)
from a template to a signed PDF in the lead's card — our own DocuSign-like flow, no account for the client.

| Piece | Where |
|---|---|
| Rules + texts (pure, tested): company, the 8 clauses with `{placeholders}`, fee arithmetic (percent / fixed / months of rent, VAT), `AH-<year>-NNNN` numbers, Israeli ID checksum, input cleaning, statuses, `publicView`, the lead's compact entry, every WhatsApp / email text, stats | `lib/documents.js` (+ `.test.mjs`) |
| Hashes (node only): the event chain `sha256(prev \| event)`, file SHA-256, the token hash | `lib/documents-hash.js` |
| The PDF: pdf-lib + Rubik (embedded from `lib/fonts/rubik-*.js`, base64) + the Unicode bidi algorithm (`bidi-js`) per line; the logo PNG `lib/doc-assets/logo-black.js` (rebuild: `node scripts/raster-logo.cjs`); a certificate page on a signed document | `lib/doc-pdf.js` (+ `lib/doc-pdf.test.mjs`, which extracts the text with poppler when present) |
| The Word file (`docx`, bidirectional paragraphs, Rubik, tables, the signature image) | `lib/doc-docx.js` |
| Server: Supabase tables + the private bucket `documents`, settings, sending (WhatsApp through Green, email through the office Gmail with the PDF attached), OTP, signing, copies + office notices, the lead link | `lib/documents-server.js` |
| API `/api/meta/docs-*` (admin) · `/api/meta/sign-*` (public, token in `t`) | `api/meta.js` → `handleDocs` |
| DB: `documents`, `document_events` (hash chain), bucket `documents` (applied 2026-11-03) | `server/documents-migration.sql` |
| Admin tab: tiles, list (search / status / period), the wizard (lead → property → terms & fees → preview → send) with the live A4 preview, the drawer (files, send log, audit chain, resend / fresh link / cancel), settings (VAT, default agent, notify numbers + email, logo, the clause editor) | `src/DocumentsTab.jsx` |
| The A4 sheet in HTML (the wizard's preview and the client's page) | `src/DocPreview.jsx` |
| The client's signing page: the document, zoom, OTP by WhatsApp / email, name + ID, consent, a drawn (or typed) signature, the done screen with the signed copy | `src/SignPage.jsx` (route in `src/main.jsx`, noindex) |
| The lead card's tab "מסמכים וחתימות" (`crm_data.documents[]`, "+ מסמך חדש" → `afik:new-doc` → the wizard on that lead) | `src/LeadDocsTab.jsx` |

**Templates from any document (v2, 2026-11-04):** "תבניות" → "העלאת מסמך חדש": a Word file (mammoth), a PDF with a text layer
(pdf-parse) or a scan / image (Claude's vision through `claudeJson` with content blocks — the office is told to proofread; without
`ANTHROPIC_API_KEY` the text can be pasted) → `POST docs-extract` (the bytes; the file kept under `templates/` in the bucket) →
`lib/doc-extract.js` (tested with our own Word / PDF output) → `textToBlocks()` (headings, numbered clauses, paragraphs) +
`detectFields()` (blanks, ת.ז., phones, emails, dates, percents, prices → suggested standard fields) in `lib/doc-templates.js`
(tested) → `src/TemplateEditor.jsx`: three panes — the fields (the standard ones, `STANDARD_FIELDS`, grouped: client / property /
project / fees / agent / company / document, filled by the CRM; the template's own fields, "+ הוספת שדה": label, key, type —
text / number / date / money / percent / checkbox / select —, required, default, hint), the document (blocks as editable
paragraphs; select text → a field; the suggestions applied in one click; block kind heading / paragraph / clause; add, delete,
reorder) and the settings (name, title, the fixed sections: parties / property / fees / signatures, the chosen field). Saved in
`doc_templates` (`server/documents-v2-migration.sql`); the built-in brokerage order is `brokerageTemplate(clauses)`. A
template's `{KEY}` placeholders (and the legacy `{camelCase}` ones) are filled by `templateValues()` / `renderBlocks()`; every
renderer (PDF, Word, the HTML sheet, the signing page) draws `blocks` + the template's `sections`, so a custom document can
drop the property / fee tables. The wizard: a template step, the client + **project** step (`ProjectSelect`; prefilled from the
lead's project), property / fees only when the template needs them, a "פרטי המסמך" step for the template's own fields (required
ones block the send; the empty standard keys are listed), the live preview, send. `documents` carries `template_id`, the frozen
`template` (at the first send), `project_id` / `project_name`, `agent_name`; `data.fields` holds the own field values. The
server runs without the v2 migration (every read / write falls back to the v1 columns once it sees the missing column —
`v2Ready()`, `status().v2`; the tab shows a hint). The tab has areas: סקירה (tiles + breakdowns by project / agent / type /
month — a row scopes the list), כל המסמכים (filters: status, period, project, agent, type; columns incl. project, agent,
channel, opened), תבניות, הגדרות; `?project=<id>` / the projects manager's "מסמכים וחתימות" button (`afik:project-docs`) open
the tab scoped to a project with its own KPI strip (sent / waiting / signed / completion %). Probe action `docs` checks
`docs-templates` and `docs-drive-status` too.
**Several signers, reminders, Google Drive (v3, 2026-11-04):** the wizard's client step has "חותמים נוספים" (a spouse / partner /
guarantor — `data.signers`, ≤ 3 after the client, `SIGNER_ROLES`); the signing runs **in order**: `data.signing = { current, list:
[{ i, name, phone, email, role, status: waiting | sent | opened | signed, sent_at, signature, signature_path }], reminders, tok,
noRemind }` is made at the first send (`startSigning`), the document's own token / OTP columns always belong to the signer whose
turn it is (`currentSigner`), `publicView` points the OTP at them (`signer: { index, total, name, list }` — the signing page shows
"חותם 2 מתוך 2" and the order), a signature advances the state (`advanceSigning`) and sends a fresh link to the next signer
(`nextSignerWaText` / `nextSignerEmail`, events `partial_signed` + `signer_sent`, the office's "חתמו 1 מתוך 2" WhatsApp, the page says
"החתימה שלכם נקלטה … עובר לחתימת X"); the last signature renders the signed PDF with a box per signer (`signatures` in `renderPdf`,
the certificate page lists every signer) and sends the copy to every signer. The table shows "1/2", the drawer the order. **The
current link is kept encrypted on the document** (`signing.tok`, AES-256-GCM in `lib/documents-hash.js` `encryptToken` /
`decryptToken`, key from `DOC_TOKEN_SECRET` else the service key; the lookup stays by hash), so "שליחה חוזרת" and every reminder
carry the SAME link the client already has (a renewal / expiry makes a new one). **Reminders** (`settings.reminders { enabled,
days: [2, 5], from: 9, to: 20 }`, settings tab "תזכורות והתראות"): `remindUnsigned()` in `auto-tick` / `auto-run` — `reminderDue()`
(tested): the clock starts when THIS signer got the link, one step once, one a day at most, Israel hours, never for a signed /
cancelled / expired / muted document — `reminderWaText` / `reminderEmail`, event `reminder_sent`, `signing.reminders[]`, the send
log; the drawer has "שליחת תזכורת עכשיו" and "בלי תזכורות למסמך הזה" (`POST docs-remind { id, now } | { id, off }`). **Office
notifications per event** (`settings.notifyOn`: opened · partial · signed · expired · failed · reminder — `notifyOffice()` →
`officeEventText()`, the office line + the settings' numbers). `sweepExpired` now notes the lead and tells the office. **Google
Drive** (`lib/google-drive.js`, tested; a sync target only — the database and the private bucket stay the source of truth): the
calendar's Google OAuth client with the `drive.file` scope (the app sees only files it made), the same callback URL
(`booking-oauth-callback` routes a state carrying `.drive.` to `Drive.connect`), the refresh token in `app_settings.google_drive`
(+ the folder-id cache). Every sent PDF and signed PDF is queued (`data.drive = { status: pending | synced | error | failed, want,
files: { original | signed: { id, name, link, folder } }, tries, error }`, `driveQueue()` tries at once with a 9 s cap) and
`driveTick()` (auto-tick / auto-run / "סנכרון עכשיו" = `POST docs-drive-sync { id? }`) uploads what is owed: the tree
`Afik HaNahal / Documents / Projects / <project> / Sent Documents · Signed Documents` (`General/` without a project, `Templates/`
for uploaded template sources), the name `[Project]_[Client]_[Type]_[Date]_[Sent | Signed].pdf` (`driveFileName` /
`driveFolderPath`, tested), a row per upload in `drive_files` (`server/documents-v3-migration.sql` — self-contained, includes v2;
the server works without it), events `drive_synced` / `drive_failed`, the office told on the first and the fifth failure. Settings
tab "Google Drive": connect (`POST docs-drive-connect` → Google's consent page; needs "Google Drive API" enabled in the calendar's
Google Cloud project), disconnect, the switch, the counts (`GET docs-drive-status`), the root folder link; the table has a Drive
column (a cloud: green = in Drive with its link, grey = pending, red = error), the drawer the files and "סנכרון עכשיו". Not yet:
initials per page, an external provider's webhook (nothing pretends to be one), Drive → database (one-way by design).
**The document's look (2026-11-04, PDF · Word · the on-screen sheet, all the same):** clause text justified (`Page.text({ justify })`
spreads the visual line's words; never the last line of a paragraph), phones as 050-123-4567 (`fmtPhone`, also inside the clauses),
a "המתווך" block (name, licence, phone) after the client, the fee table with a top rule, a slim header on later pages (small logo ·
company · document number), a green "נחתם דיגיטלית · date" stamp in the header of a signed document, a faint diagonal "טיוטה" on a
draft, headings and clause titles kept with their first lines, the signature block kept with its heading (`need()` before each).
**Short signing links + the signing page on a phone (2026-11-04):** the link is `https://www.afikhanahal.co.il/s/<code>` — 10
lowercase English letters / digits without look-alikes (`newSignCode()` in `lib/documents-hash.js`, `SIGN_ALPHABET`, ~50 bits;
signing also needs the one-time code), read case-insensitively; the older `/sign/<token>` links still open (`signTokenFromPath()`
in `lib/documents.js`, tested; the route in `src/main.jsx` takes both). The page (`src/SignPage.jsx`) is mobile-first: an intro
card on phones ("שלום <name>, המסמך מחכה לחתימה שלכם", the 3 steps, "מעבר ישיר לחתימה"), the document, then the panel as
numbered steps (code → details → signature) with ✓ as each is done; inputs 16 px (iOS doesn't zoom), buttons ≥ 44 px, the code box
gets the focus with `autocomplete="one-time-code"`, "send again" after a minute, a white signature pad with a baseline and ✕, the
bottom "לחתימה" bar hides once the panel is on screen (IntersectionObserver), safe-area insets. **PDF and Word downloads** in the
header at every stage and on the done screen: `sign-file?kind=original | signed | docx` (`signedFileByToken` renders the Word file,
with the client's signature once signed). The Word file: the logo on the right, the "המתווך" block, a footer with the document and
"עמוד X מתוך Y", headings kept with the next paragraph, the signature row never split. QA: the scratchpad's `qa-sign-mobile.cjs`
(iPhone 13 + a 360 px Android).
**"מסמך מהיר מנכס" — a document from an existing property (2026-11-04, `QuickDoc` in `src/DocumentsTab.jsx`):** the tab's header
button, the property gallery's ⋯ "✍️ מסמך לחתימה על הנכס" (`afik:new-doc { propertyId }` → the admin's `docsPropId`) or
`/admin-panel/documents?property=<id>`. Step 1: the properties as cards (cover, title, place, deal · rooms · size, price; search by
name / town / street / type / gush; "באוויר" or every property; a "שמור" tag on one that has a preset). Step 2: everything fixed is
filled from the record — `propertyToDoc()` (`lib/documents.js`, tested): address (street + number, else the title), town,
description (type, rooms, m², floor, dunams), deal type, price, the property's `/p/<id>` link, gush / helka in the notes; a rental
starts on one month of rent — and only what changes is asked: the client (a lead from the CRM or typed), the fee (percent chips 1 –
3 % or any, months, fixed; the price editable; the fee / VAT / total line), the template's own fields; "פרטי הנכס, פרויקט, תנאים
ותוקף" folds the rest. "לזכור לנכס הזה" (on) saves the template, the fee, the terms, the validity, the project and the client's role
as the property's preset (`settings.presets[propertyId]`, `cleanPreset()` / `mergePresets()` — ≤ 300, the newest kept; `POST
docs-settings { presets: { id: preset | null } }`), so the next document on that property asks for the client only. Live preview,
"שליחה לחתימה" = create + send in one click (the channel follows the client's phone / email until picked by hand — also in the
wizard), "טיוטה", "לאשף המלא" (the wizard opens with everything filled, `init.prefill`), and after sending "מסמך נוסף לאותו נכס".
Phones: one column, the footer stacked. QA: the scratchpad's `qa-quickdoc.cjs`.
**Clause 6 and the signing step (2026-11-04):** the fee clause reads one amount per line — "דמי תיווך של {feeBasis}, בסך {commission}
לפני מע"מ." / "לסכום זה יתווסף מע"מ כדין בשיעור {vatRate}, בסך {vat}." / "סך הכל לתשלום: {total} כולל מע"מ." / "מחיר העסקה לצורך
החישוב: {price} לפני מע"מ." (the percentage once; no amount squeezed in brackets; the Word file breaks the lines too — `lines()` in
`lib/doc-docx.js`). The signing page's step 3 is a tinted "חתמו על המסמך" card: a white pad in a dashed brand frame with a soft
pulse (none with reduced motion), "✍ חתמו כאן · ציירו את החתימה באצבע (או בעכבר) בתוך המסגרת", the line with ✕, "חתימת <name>" and
the date under it, green + "✓ החתימה נקלטה" once drawn, "ניקוי וחתימה מחדש"; the document's own client box is a dashed "✍️ חתמו
כאן" button that scrolls to the pad (`onSignHere` on `DocSheet`), and a "לפני החתימה: קוד אימות · חתימה · אישור" checklist sits over
the button until all three are done.
**Signing without a code, a formal page (2026-11-04):** the personal link is the verification — the signing page has no
one-time code step any more: "פרטי החותם" (name, ID) → "חתימה" (a calm dashed frame, "חתמו כאן", no icon / emoji / ✕ / pulse) →
consent → "אני מאשר/ת וחותם/ת". `submitSignature` checks a code only when one is sent (older pages); otherwise the signature is
`{ method: 'link', via: <the channel the link last went out on — linkChannel() from the send log>, to: masked }`, and the time,
IP, browser and the hash chain are recorded as before. `verifyLabel(sig, long)` (`lib/documents.js`, tested) writes it everywhere
— the PDF box ("אומת באמצעות קישור אישי לוואטסאפ"), the certificate and the Word file ("קישור אישי שנשלח לוואטסאפ 054-***-*491"),
the admin drawer; an older signature still reads "קוד חד-פעמי…". The phone's top card is a plain document header (מסמך לחתימה ·
number, the title, for whom · address · valid until) with no button; the document's client box is a signature line with a quiet
"לחתימה" link; the bottom bar reads "המשך לחתימה". `sign-otp` stays for old links only.
**Flow:** `docs-create` cleans the input (`cleanDocInput`), links the CRM lead (the given id, else the newest lead with that phone /
email — never a new lead), numbers the document and writes `created` on the lead. `docs-send {id, via}` makes the private token
(kept only as a hash), freezes the clauses on the row, renders the PDF the client signs (stored, its SHA-256 on the row), and
sends the link by WhatsApp and/or email (PDF attached); the row logs every send. `sign-open?t=` marks `opened`; `sign-otp` sends a
6-digit code (10 min, 5 tries) to the client's WhatsApp or email; `sign-submit` verifies it, stores the signature PNG, writes the
`signed` event, renders the signed PDF with the certificate page (signer, time, IP, user agent, hashes, the whole event chain),
then `afterSigned()` — once (`notified_at`) — emails the client the signed copy, texts them, texts the office line + the settings'
numbers and emails the office (PDF attached), and updates the lead (`crm_data.documents`, a ✅ note). A sent document can't be
edited; cancel kills the link; a signed one is never cancelled. Expired links are swept on every list read. `docs-preview` renders
a draft's PDF without storing anything. **Provider:** the built-in electronic signature (OTP + drawn signature + hash chain); an
external provider (DocuSign / Adobe Sign) would plug in at `sendDoc` / `submitSignature` — nothing pretends to be one. The clause
wording is the office's responsibility (paste the master file's text in "תבניות"; `app_settings.doc_templates`); settings are
`app_settings.doc_settings`. Probe action `docs`. QA: the scratchpad's `qa-docs.cjs` pattern (mocked APIs).

## Booking page (`/book`) — our own Calendly

`https://www.afikhanahal.co.il/book` (also `/booking`, `/meet`; `?lang=en`, `?type=<id>`, `?ref=` / `utm_campaign` is kept
on the lead; noindex) lets clients book calls and meetings in the office Google Calendar (`afik.hanahal@gmail.com`), in the
site's colors (dark `#09090F` / purple `#8490D8`, light `#F5F1E9` / `#3F4EB0`, follows the device theme), Hebrew / English.
Steps: meeting type (skipped when there is one) → month calendar + free times (Israel time) → how to talk (Google Meet / Zoom
/ phone) + name, phone, email (required for video), notes → confirmation (Meet link, add to calendar, WhatsApp to change).

| Piece | Where |
|---|---|
| Rules (pure, tested): default settings (first type "שיחת היכרות", 30 min, Meet / Zoom / phone), office hours Sun–Thu 9–19, Fri 9–14 (= the site's hours in `content/site.mjs`), free slots in Israel time (DST-safe) minus busy time + buffer, min notice, horizon, daily cap, validation, the calendar event | `lib/booking.js` (+ `lib/booking.test.mjs`) |
| Google Calendar through the office's own Google account (OAuth: signed state, refresh token in `app_settings.google_calendar`, freeBusy, events with `conferenceDataVersion=1` + `sendUpdates=all`) | `lib/google-calendar.js` |
| Server flow: settings (`app_settings.booking_config`), slots, a booking, admin list, cancel | `lib/booking-server.js` |
| API `/api/meta/booking-*`: public `config` · `slots` (edge 20 s; `m=` → no-store) · `create` · `manage` · `reschedule` · `cancel-self` · `oauth-callback`; admin `admin` · `settings` · `connect` · `disconnect` · `cancel` · `resend` | `api/meta.js` → `handleBooking` |
| Public page (own chunk) | `src/BookingPage.jsx` (route in `src/main.jsx`) |
| Admin tab "תיאום פגישות" (`/admin-panel/bookings`, Apple-like grouped lists: day switches, time pills, steppers, a save bar): link, KPIs, the calls grouped by day (time column, a status bar, calendar / WhatsApp / email icons with tips, cancelled and past calls folded away), "מסונכרן עם היומן" + ↻ (re-read every minute while visible — the server re-checks every event first), per call: copy the client link, **move** (an inline panel with the free days / times, the call's own time freed, "tell the client" on by default → `booking-move` = `moveByOffice()`; the office isn't alerted about its own move) and **delete** ("delete and tell the client" / "delete quietly" → `booking-cancel {id, notify}`; quiet = Google's `sendUpdates=none`, no WhatsApp / email; a note on the lead either way), resend when WhatsApp failed, **invitees** (the client + extra emails → `booking-guests` = `setGuests()`: the event's attendees are replaced, Google invites the new ones / cancels removed ones, the event is read back and any address Google didn't keep is reported; `guestList()` / `eventAttendees()` in `lib/booking.js`, tested; a note on the lead), "open in Google Calendar" (`htmlLink`); a move is **verified** — the event is read back and the booking says "in the calendar" only when Google shows the new time (`calendar: 'error'` + `calendarError` otherwise, a red calendar icon) — and every action ends with a plain notice of what happened in the calendar; hours, call type, rules, calendar connection, Zoom link | `src/BookingAdminTab.jsx` |

A booking: re-checks the slot against a fresh calendar read (never double-books; every booking is also in
`app_settings.booking_log`, so it works before the calendar is connected — then the office adds it by hand), creates the
event (Meet link + invitation to the client's email), creates / updates the lead in `contacts` (source `booking` =
"קביעת שיחה באתר", stage **new** — an existing lead keeps its stage unless it was lost / irrelevant / nurture —,
`crm_data.booking` / `bookings`, `formAnswers` with the booking's answers, the needs the client wrote parsed by
`notesToNeeds()` (deal / property type / town from `src/data/israelCities.json` / budget / rooms; tested), a 📅 note,
`followUp` = the meeting; the automatic welcome is skipped — the confirmation is the first message), sends the client a
WhatsApp + a formal email confirmation and then alerts the office (WhatsApp `notifyTeam` + email, both saying whether the
client's confirmations went out). Messages and emails are `lib/booking-messages.js` (tested: table-based HTML, no emoji,
time ranges kept LTR in Hebrew). **The client's own page** `/book?m=<id>.<token>` (the private link in every confirmation;
`entry.token`, compared in constant time): every detail of the call, "שינוי מועד" (the calendar with the call's own time
freed — `subtractInterval()`; `booking-reschedule` patches the Google event, updates the lead and tells both sides, max
`MAX_RESCHEDULES`), "ביטול השיחה" (`booking-cancel-self`; `?do=cancel` opens the question), add to Google Calendar, copy /
WhatsApp-to-self the link. After a booking the address becomes this page. **Green API refused** (quota 466): the result
is stored per booking (`entry.wa`), the admin shows it and offers "שליחת האישור שוב" (`booking-resend`), and `auto-tick` /
`auto-run` retry it (`retryConfirmations()`, 3 tries, stops at the first quota refusal). Limits: 2 upcoming bookings per phone, 6 attempts per IP in 10 minutes, a honeypot field.
**The office's own calendar changes win:** `syncCalendar()` / `syncEntry()` (`lib/booking-server.js`, rule `calendarChange()` in
`lib/booking.js`, tested) re-reads every upcoming booking's event (`GCal.getEvent`) when the admin list loads, when the client opens
the private page and before every confirmation retry (auto-tick / auto-run, throttled to 3 minutes): an event deleted or cancelled
in Google Calendar cancels the booking **quietly** (`cancelledBy: 'calendar'`, no WhatsApp, no email, no more retries, `resend`
refuses it; a note on the lead), an event dragged to another time moves it. Google's own reminder email (60 min before) stops by
itself once the event is deleted. **The client declining / removing the invitation in their own calendar** (their attendee row
`responseStatus: 'declined'`, matched by the booking's email — Google keeps the event in the office calendar and would still send
the reminder) cancels the booking too (`cancelledBy: 'guest'`, `calendarChange()` → `{ cancel: true, by: 'guest' }`): the event
is deleted from the office calendar, the office gets a WhatsApp + email ("הלקוח דחה את הזימון ביומן", `officeText` /
`officeEmail('declined')`), the client gets nothing, a note on the lead. **Every cancel verifies the calendar:** `removeEvent()`
deletes the event and reads it back; when it is still there the booking keeps `calendarPending` (+ `calendar: 'error'`,
`calendarError`) and every `syncCalendar()` (auto-tick every 5 min) tries again until the call's time passes; the admin's
delete says so instead of "deleted ✓" and the cancelled row shows "עוד ביומן Google". auto-tick runs `syncCalendar()` through
`retryConfirmations()`.
Templates: `{bookingLink}` (`vars.bookingLink`, `?lang=en` added for English) in `welcome_book` and `book_link`.
**The page itself:** a 48 px logo, a WhatsApp button in the header and a "write to us / call us" card in the side panel, and a
figure there (`photo` in the booking settings, default `/img/booking-portrait-2.webp`, 900×874 — a cut-out portrait with no background,
**edge to edge**: the full width of the side panel and down to its bottom edge (negative margins = the panel's padding, `--side-px` /
`--side-pb`), under the WhatsApp / call buttons, at most 58vh tall; admin "תמונה בעמוד"; never on phones, where it isn't even loaded).
**Time zones (Calendly style):** under the calendar a "אזור זמן" button (the zone + its current time) opens `TzPicker` in
`src/BookingPage.jsx`: search (Hebrew / English / IANA id / GMT offset), zones by region with their current time and offset, a
24 h / AM-PM switch, ↑ ↓ Enter Esc, a bottom sheet on phones. The default is the visitor's device zone (Israel for most), the
choice is kept in `localStorage.afik_bk_tz_v1`; the free times are regrouped by the visitor's own days (`regroupSlots()`), the
chosen time also shows the Israel time ("לונדון · בישראל 09:00"); the office, the calendar and every confirmation stay in Israel
time (`src/lib/bookingTz.js`, tested). **The calendar's look:** rounded-square day cells, free days tinted with a dot, today ringed, the chosen day filled with a soft shadow, the month and the times fade in on change, time buttons as calm cards ("N שעות פנויות" under the day). **Phones (≤ 900 px), every step:** a one-row summary on top (title, length, channel, the chosen time), the step itself (a strip of
days + 3-column time chips for booking and for a move, the month grid one tap away; the details' main button sticks to the bottom
of the screen; the call page's and the move's buttons full-width and stacked), and the WhatsApp / call row at the bottom of the card. **Speed:** `index.html` starts `booking-config` + `booking-slots` (22 days, the URL's `type`) before the bundle
loads (`window.__bk`); `BookingPage` uses them once instead of asking again, so the calendar shows with the first render.
**On the site:** `BookPill` (purple pill: hero, contact form, end of the FAQ), `BookBand` (after the properties grid) and
`BookLink` (property window, mobile menu, footer, sent screen) in `App.jsx`; texts in `content/home.json` → `booking`
(`cta`, `line`, `after`, `bandTitle`, `bandDesc`, `faq`).
**Defaults:** the page is "אפיק הנחל - ייזום שיווק ותיווך"; the first meeting is "שיחת היכרות", 30 minutes, **by phone only** (no
email asked; with a single channel the "how" step is a one-line note) — Meet / Zoom can be added per type in the admin.
**Traffic → meetings:** `BookLink` in `App.jsx` (`/book?ref=<where>`, `trackEvent('booking_click', { src })`) in the hero (under the
CTAs), the contact form and its "sent" screen, the property window (`ref=prop-<id>`), the mobile menu and the footer; the content
pages put "📅 קביעת שיחת היכרות" first in their CTA row (`ref=page_<type>_<slug>`). The texts are `content/home.json` → `booking`
(editable in "תוכן האתר"; `content/site.mjs` `UI.ctaBook` reads the same). `/book` is a known SPA route for the build's link check.
**Setup:** Google Cloud project → enable "Google Calendar API" → OAuth consent screen (External, **In production** — in
"Testing" the access expires after 7 days) → OAuth client ID (Web) with the redirect URI
`https://www.afikhanahal.co.il/api/meta/booking-oauth-callback` → Vercel `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
→ redeploy → admin "תיאום פגישות" → "חבר יומן" (log in as afik.hanahal@gmail.com). Never put the client secret or the token in code.

## Admin dashboard, Google Analytics & chat names

A direct visit to `/admin-panel(/<tab>)` (or `/dashboard`) opens the full-screen dashboard (sidebar layout, `AdminPanel standalone`);
the in-site modal is only used when the admin is opened from the site itself. `DASHBOARD_MODE` in `App.jsx` is decided once at load.
**Phones get the dashboard, never the modal:** opening the admin from the site on a screen ≤ 900 px reloads into
`/admin-panel` (the modal's wrapped tab grid and short panes don't fit a phone). The dashboard on a phone: a sidebar drawer
(no shadow while closed — it used to leave a grey band on the screen edge), a bottom bar with the five most used screens
(overview · leads · chats · Lead Center · properties; "באוויר" is the published filter of the property list, not a screen —
`/admin-panel/live` opens the property list), one-line notices, floating buttons (`.lb-fab`) above the bottom bar, and
one pane at a time in the chats (`.wa-has-contact`, the status strip hidden) and in "נכסים שנקלטו" (`.ss-has-sel`, a
"לכל הנכסים" back button). The property wizard is mounted in both modes (`wizardEl` in `App.jsx`), so "ערוך" in the
dashboard opens it (it used to log out); a wizard save merges over the stored property, keeping `sortOrder` and the
quick-form-only fields.

| Piece | Where |
|---|---|
| Home page (greeting, KPIs, live system status, pipeline, recent activity) | `src/AdminHome.jsx` |
| Google Analytics traffic dashboard (live panel, KPIs, contacts, chart, insights, channels, campaigns, sources, landing pages, pages + drill-down, devices, geo, heat map, actions) | `src/GA4Tab.jsx` |
| GA4 Data API client (service-account JWT, batch reports, 5-min cache, realtime) | `lib/ga4.js` (+ `lib/ga4.test.mjs`) |
| API: `POST /api/meta/ga4-dash`, `/ga4-property`; legacy `GET /api/meta/ga4?days=…` / `?realtime=1` (home tiles) | `api/meta.js` → `handleGA4Dash` / `handleGA4` |

GA4 needs a service account with Viewer on property `536943897` (Analytics Data API enabled): `GA4_SERVICE_ACCOUNT_JSON`, or
`GA4_CLIENT_EMAIL` + `GA4_PRIVATE_KEY`, or the Korkos site's names `GA_SA_CLIENT_EMAIL` + `GA_SA_PRIVATE_KEY` (the same key works for
both sites once it is a Viewer on each; `normalizePrivateKey` forgives quotes / literal `\n` / a one-line paste). The property id is
`GA4_PROPERTY_ID`, else `app_settings.ga4_property_id` (editable in the tab's "הגדרות חיבור", `POST /api/meta/ga4-property` saves and
tests), else `536943897`. Without credentials the tab shows the setup steps (the Korkos-key way first). Health `env.ga4` says whether
they are set; an auth error shows the configured key's id (`keyId`, from `private_key_id`) to compare with Google Cloud → Keys. **Concurrency:** Google allows ~10 concurrent Data API
requests per property; the dashboard + live panel + home tiles together went over it (429 "Exhausted concurrent requests quota").
`gaPost` (`lib/ga4.js`, tested) sends at most `GA_LIMIT.max` (3) at a time per instance, retries a 429 / 503 after 1.2 / 3 / 6.5 s,
and only then throws `kind: 'quota'`; the dashboard then serves the last good reports (`stale: true`, a note in the tab), and the tab
itself retries a quota error after 10 / 20 / 30 s with a countdown. The key-id note shows only for `kind: 'auth'`. The old Supermetrics route is kept as a fallback only (its trial ended 2026-06-16).
**The traffic dashboard** (`src/GA4Tab.jsx`, the first sub-tab of "אנליטיקס"; built like the Korkos site's) reads
`POST /api/meta/ga4-dash` (`lib/ga4.js` `dash()` / `dashSpecs()` / `previousRange()`, tested; `type`: dashboard · realtime · page ·
test; 5-min cache, realtime 25 s): presets 7 / 30 / 90 days / this month / last month, each vs the previous period of the same
length; a live panel (users in the last 30 min, a per-minute views sparkline, pages now, devices now, today's channels / sources /
totals) with "אל תספור את הביקורים שלי" (`localStorage.afik_no_track` — `index.html` then loads no GTM / GA / Pixel; any page opened with `?notrack=1` sets it, `?notrack=0` clears it; the admin
pages never load them); KPIs with sparklines + a secondary strip; **contacts** = CRM leads in the same Israel days (site vs
Facebook / Instagram, from the admin's `leads`) + GA's `contact_form` / `phone_click` / `whatsapp_click` / `email_click`
(`CONVERSION_EVENTS` — filtered reports, not GA's keyEvents switch); the main chart (metric, day / week / month, previous period,
z-score anomaly dots, tooltip); auto insights; channels / UTM campaigns / source-medium / landing pages / pages (search, sort, CSV,
contact rate, ★ quality; a page row opens a drill-down) / devices + new vs returning / countries & cities / weekday × hour heat map
/ site actions. `trackEvent` never sends name / email / phone to GA (Google's terms).
**Look (shared by both analytics tabs):** `src/analyticsUI.jsx` — `AN_CSS` (full page width, no max-width; a calm Apple-like
scale: 13px body, 20px title, 24px KPI values, semibold not black; hairline separators; segmented controls), `TipLayer` (one
fixed-position tooltip for every `[data-tip]` inside `.an`, clamped to the viewport, never clipped by a scrolling table) and
`Lbl` (a label with a short ⓘ explanation). Every number, column header and section carries a few-word bilingual tip
(`tips` / `colTip` / `sectTip` in `GA4Tab`'s TR). Wide screens put pairs side by side (chart + insights, channels + campaigns,
sources + landing, pages + actions, devices + geo + heat map). "האתר שלנו (הדפדפן הזה)" is `src/SiteLocalTab.jsx` (this
browser's own `ANALYTICS_KEY` events, same look); the old gradient cards and their 2-minute legacy GA device poll are gone.

WhatsApp chat names (`chat-list`): outgoing Green API messages carry no contact name, so names are resolved server-side from
leads (`contacts`), `meta_leads`, the WhatsApp phone book (`getContacts`) and, for a few chats per poll, `getContactInfo` —
all matched by the last 9 digits and cached for 10 minutes. The office's own / notification number is flagged `office` and shown
as "המשרד · התראות מערכת"; a number without any name is shown as 05X-XXX-XXXX.

### Properties page (admin "נכסים", `/admin-panel/properties`) — gallery first

`src/PropertyGallery.jsx`: the page opens on the properties themselves — a compact header (`PropertiesHeader`: title, live /
hidden / total counts, a gallery · "סדר באתר" switch, "טופס מהיר", "עוד ▾" = refresh from the server / sync all / JSON backup,
and the one primary action **"+ נכס חדש" = the property wizard**), a sticky toolbar (search by name / town / street / type /
gush, live · hidden, category, status, sort: site order / recently updated / name / price; kept in `sessionStorage.afik_props_view_v1`,
so coming back from an edit lands on the same view) and the gallery (`auto-fill minmax(250px, 1fr)` — the whole width; 4:3
cover, live / hidden, sold / rented, exclusive and "#position on the site" pills, photo count, category · type, name,
place, specs, price, updated). **A click on a card edits that same record in the wizard** (`editProp` → `onEditInWizard`,
never a copy); per card: the live switch, share (`PropertyShare`), "⋯" (wizard / quick edit, duplicate, to the top of the
site list, sold / rented / back on the market, open on the site, refresh, delete) and a checkbox for the bulk bar (publish /
hide / status / delete). "סדר באתר" shows the old `PropertyManagerList` (drag to reorder, ▲▼). **The quick form is closed by
default**: "טופס מהיר" / "עריכה מהירה" open it in a side window (`QuickFormDrawer`) with every field in sections
(`FormSection`: general, property details, amenities, price & status, description, links / map / videos, photos & logo) —
all open, each can be folded (folded = hidden, never unmounted, so an upload keeps going), "פתיחת / סגירת כל הסעיפים", the save
buttons in a fixed footer; a successful save closes it, Esc / ✕ closes without losing the form.

### Contact export (leads board → "ייצוא לאקסל")

`src/ExportDialog.jsx` + `lib/contacts-export.js` (tested) + `lib/xlsx-writer.js` (a dependency-free .xlsx writer: stored zip,
inline strings — nothing is ever evaluated as a formula —, RTL sheet, bold frozen header, auto-filter; tested): which contacts
(only the selected · the list on screen · everyone · one pipeline stage · one campaign), which file — **Excel** (`EXPORT_COLUMNS`:
31 columns with Hebrew headers, picked by the office and remembered in `localStorage.afik_export_cols_v1`; phones as text with
the leading 0 plus a `+972…` column, dates in Israel time, budget as a number; `contacts_export_YYYY-MM-DD.xlsx`) or **a Meta
customer list** (`metaAudienceCsv`: CSV with Meta's identifiers `email, phone (972…), fn, ln, ct, country`, one row per person —
duplicates by phone / email merged, rows with neither left out, people who opted out left out unless ticked; no BOM; cells
that could start a formula are prefixed; `meta_audience_YYYY-MM-DD.csv`) for a Custom Audience and a Lookalike in Ads Manager.
Built in the browser from the loaded leads; nothing is uploaded anywhere. **Settings** (`/admin-panel/settings`) has a sticky
index of its sections (`.crm-settings` / `.crm-set-nav`, each section a `.crm-sec` card with an `id="set-…"` anchor — shared CSS
at the end of `ADMIN_THEME_CSS`). Desktop pages use the whole width (the automations,
bulk sends and the in-site admin window lost their max-widths).

### Image library (admin "תמונות האתר", `/admin-panel/media`)

`src/MediaLibraryTab.jsx`: every image the site shows. **Site design** = `public/img/*` and the root logos, listed at build
time in `dist/site-images.json` (`scripts/build-content.mjs` + `lib/site-images.js` `inventory()`, tested: size and where each
file is referenced — homepage content, website, booking page / emails, share pages, admin). **Property photos** = every
`images[]` URL of every property (thumbnails through the CDN). Per image: download the original; "שינוי גודל והחלפה" — a
canvas editor (width / height with the ratio kept, presets 600 / 1200 / 1600 / 2400 never upscaled — `fitSize()`, WebP / JPEG /
PNG, quality, before / after size), a different file by picking or dropping one, download the result, or replace: a property
photo is uploaded to Supabase Storage (the wizard's signed URL) and the property saved with the new URL in the same place
(`replacePropertyPhoto` in `AdminPanel.jsx`); a design image keeps its name and format and is committed to the repository
(`POST /api/meta/media-replace` → GitHub contents API, `REPLACEABLE` paths only, ≤ 3 MB) so Vercel redeploys in ~2 minutes —
it needs `GITHUB_CONTENT_TOKEN` (fine-grained, this repository, Contents read & write; `media-status` says whether it is set,
the tab shows the setup steps otherwise). `/img/*` is cached for a day (`vercel.json`), so a replaced file reaches returning
visitors within a day.

### Video studio (admin "סטודיו וידאו", `/admin-panel/studio`)

The office edits real-estate videos with **OpenMontage** (github.com/calesthio/OpenMontage, AGPLv3: agentic video production —
Python, FFmpeg, Remotion, optional AI providers) driven by **Claude Code on the office PC** (`C:\Users\HP\Desktop\Downloads\
OpenMontage-main`). It can't run on Vercel and the site never runs or calls it. `src/VideoStudioTab.jsx`: pick properties (live /
all, search) and the look (format 9:16 / 4:5 / 16:9 / all, length, mood, voice, language, real material vs AI "הדמיה", music, a
footage folder, notes, an AI budget) → **the instruction for Claude Code** (`lib/video-brief.js` `buildBrief()`, tested: the
facts only from the record, the property's `?one=` / `/p/` links, its photos inline when it isn't published, batch = one for
approval then the rest), copied with one click; **the production board** (OpenMontage's Backlot, `http://127.0.0.1:4750` on the
same PC — a no-cors ping, only after it answered once so a first visit never triggers the browser's local-network prompt; a frame
or a new tab); **the one-time install** (`/studio/afik-studio-pack.zip` + the PowerShell lines for the chosen folder). The pack's
source is `studio-pack/` — `install-openmontage.ps1` (winget Python / Node / FFmpeg if missing, venv, pip, `npm install` with the
`npx --yes npm install` fallback, `.env` from the example, copies the style + skill, points OpenMontage's `CLAUDE.md` at them),
`styles/afik-hanahal.yaml` (the site's colors, Rubik, Hebrew RTL captions; valid against OpenMontage's
`schemas/styles/playbook.schema.json`), `skills/creative/real-estate-afik.md` (reel structure, truth in every number, "הדמיה" on
generated visuals, phone + `/book` at the end, plural Hebrew) and `README-he.md`. After editing it rebuild the zip:
`cd studio-pack && zip -qr -X ../public/studio/afik-studio-pack.zip README-he.md install-openmontage.ps1 styles skills`.
API keys live only in OpenMontage's `.env` on the PC. Settings: `localStorage.afik_studio_v1`.

### Admin appearance (light / dark / system) & command palette

The admin has its own theme, separate from the public site, saved in `localStorage` (`afik_admin_theme`: `dark` · `light` · `system`).
`src/adminTheme.js` holds the store (`useAdminTheme`), the admin `C` palettes (`ADMIN_DARK_C` / `ADMIN_LIGHT_C`, provided through
`ThemeCtx` by both admin mount points in `App.jsx`) and `ADMIN_THEME_CSS` — CSS variables on `html[data-admin-theme]` that every
admin component uses, portals included. When adding admin UI, never hardcode dark colors: use `T.*` from `automationsUI.jsx`
(now CSS variables), `C.*` from `useTheme()`, or `var(--au-*)`; for tints use `rgba(var(--ink), a)` (text) and
`rgba(var(--ov), a)` (surfaces). Purple has three roles, all ≥ 4.5:1 contrast: `var(--au-brand)` (fills with white text),
`var(--au-brand-text)` / `T.brandText` (purple text) and `rgba(var(--brand-rgb), a)` (tints and lines); `C.purple` is the theme's
balanced purple for code that appends a hex alpha. WhatsApp bubbles and the phone preview stay dark on purpose.
**Full width, every browser** (2026-10-30): every admin screen fills the window — the in-site admin window is full-screen too
(it was 98 % × 94 %, a dark frame around it), the frame reserves no scrollbar gutter (`.admin-shell.admin-scroll
{ scrollbar-gutter: auto }` in `index.html` — it left an empty 10 px strip), the sending-hours editor, the GA setup card and
the performance KPI row (`auto-fit`) lost their caps. Cross-browser rules: screen heights use the class `.admin-vh`
(`100vh`, then `100dvh`), never an inline `'100dvh'` alone (Safari < 15.4 / Firefox < 101 drop it and the layout collapses);
every `backdropFilter` has its `WebkitBackdropFilter` twin (and `backdrop-filter` its `-webkit-` twin in CSS strings —
React and Vite add no prefixes, Safari < 18 needs it); `AbortSignal.timeout` is polyfilled at the top of `src/main.jsx`
(Safari < 16 threw on every admin fetch); scrollbars are styled in `index.html` for both `::-webkit-scrollbar` (Safari) and
`scrollbar-width` / `scrollbar-color` (Firefox, Chrome ≥ 121). Check new JS against Safari 15.4 before using it
(`Object.groupBy`, `Promise.withResolvers`, `toSorted`, `Set` methods need a guard).
**Smart voice input — one mic for the whole admin** (2026-11-02, `src/SmartVoiceInput.jsx` + the service `src/lib/voiceService.js`):
in the chats tab's notes and follow-up, every task box (`TaskPresetInput`), the lead card's note composer and inline note edit,
the call summary (`CallNoteDialog`), the follow-ups screen's notes, the Lead Center's notes, the property description (quick form
and wizard) and the intake property's notes / description. Props: `value` / `onChange` (the target field), `contextType`
(`note` · `call` · `meeting` · `task` · `property`), `recordId`, `lang`, `hint` (names that may be said), `transcriptionMode`,
`inputRef`, `onCreateTasks(items)` (boxes that belong to a lead). **Recording:** a floating panel (no layout shift; on a phone at the
bottom, above the keyboard — `visualViewport`; 44 px buttons) with a timer, a live waveform (AnalyserNode), pause / resume, cancel
and finish; MediaRecorder (webm-opus, Safari mp4-aac, 32 kbps) cut into 2-minute pieces (each a whole file, ≤ 4 MB, transcribed
while you still talk), 15 minutes max. **Transcription** on the server, nothing stored: `POST /api/meta/voice-transcribe?mime=&lang=&hint=`
(raw bytes — the handler now reads every body as bytes; `lib/transcribe.js`, tested: `OPENAI_API_KEY` → gpt-4o-transcribe, else
`ELEVENLABS_API_KEY` → Scribe, Hebrew + a vocabulary hint of towns / projects / trade words / the lead) — `GET voice-status` says which;
without a key the browser's own recognition writes live as before (Chrome / Edge / Safari). One automatic retry; a failed piece keeps
its audio in the tab for "נסו שוב". **AI layer:** `POST /api/meta/voice-process {transcript, mode, contextType, lang, hint}`
(`lib/voice-process.js`, tested; `claude-opus-5-5`, effort low): `exact` (what was said, punctuated, stutters and false starts out),
`smart` (a professional summary that keeps every detail), `call` (titled sections in a fixed order — topic, client, needs, key
details, prices, decisions, open questions, commitments, next steps, follow-up date — only those said), `task` (one line); never
invents, marks what wasn't clear "(לבדיקה)" and lists it; and lists the **tasks that were said** with a due computed from "now" in
Israel time (validated, never in the past). The result goes into the box (still editable; the box's own button saves); the panel
switches modes (cached), "כפי שנאמר", "הקלטה חדשה", never overwrites a manual edit without asking, closes when the box is saved and
cleared; on a phone the result moves to the top. Detected tasks are offered with checkboxes, editable title / time → `voiceTaskItem()`
(`src/lib/dictation.js`, tested: a time = a follow-up with a WhatsApp reminder, a day = 10:00, none = a plain task) → `onCreateTasks`
(the lead's `updateTasks`). If the box closes mid-way (a popover), the session goes on in `VoiceHost` (mounted in `AdminPanel`), which
offers the text to copy. Errors read as words (`dictationError()`: the site blocked in the browser vs the computer blocking the browser — `micErrorCode(e, micPermission())`: Chrome's "Permission denied by system" or a site already granted → `os-blocked` with the Windows / Mac steps; mic in use, offline, failed, too long, format, no
speech). `npm run qa:dictation` (`scripts/qa-dictation.cjs`, Chromium's fake microphone — a real MediaRecorder recording) checks the
whole flow; `lib/voice-route.test.mjs` checks the bytes reach the provider unchanged. Real devices (iPhone Safari, Android Chrome)
still need a check by hand.
**Popovers keep the focus where the user types** (2026-11-02): `Popover` (`src/automationsUI.jsx`) keeps the latest `onClose` in a
ref and runs its listeners / autofocus only when it opens (`[open, anchor]`) — callers pass an inline arrow, and re-running on
every render moved the focus to the first button on every keystroke (the chats tab's "הערות" box took one letter; its selector
also skipped `textarea`). It never refocuses while the focus is already inside, and a click in the task presets list (`.tpi-pop`)
isn't "outside". Never put a callback prop in the deps of an effect that moves focus — use a ref (`PropertyShare` had the same).
**QA of the chats screen:** `npm run build && npm run qa:chats` (`scripts/qa-chats.cjs`, Playwright, every API answered locally):
every header / composer button — notes, follow-up (its "when" starts on tomorrow 9:00, so a typed task saves at once), stage,
AI summary, the templates menu / window / chips, "✓ טופל", emoji, attach, booking link, send, rename, next / previous (disabled
when there is nowhere to go) / refresh / close, the list filters — PASS / FAIL per check, exit 1 on a failure.
`src/CommandPalette.jsx` — Ctrl/⌘ + K (or the top-bar search) jumps to any screen, lead (opens the chat) or property, and runs actions.

### Lead card & smart lead analysis

Clicking a lead (board card, mobile card, table "open") opens `src/LeadCard.jsx` — a centered card with tabs: details
(contact, needs: deal type / budget / timeline / financing / area, property, management: priority / owner / follow-up / tags),
notes & activity (`crm_data.notes: [{ id, text, ts }]`), tasks (`crm_data.tasks: [{ id, text, due, done }]`) and smart analysis.
Every field saves on its own through `updateLead` → `PATCH /api/contacts` (merged into `crm_data`). **The whole conversation sits in the card:** on a screen ≥ 1100 px the card widens (1640 px) and shows the lead's WhatsApp
chat as a third column — the Lead Center's `LeadConversation` (history, templates, sending through `/api/meta/chat-send`, the
automations config read once per session); "הסתר שיחה" hides it (`localStorage.afik_lead_card_conv`). Narrower screens get it
inside the "שיחת וואטסאפ" tab under the AI summary (`LeadChatTab hideConversation`).
**Stages** (`GROUPS` in `src/LeadsBoard.jsx`, `STAGES` in `lib/automations-shared.js` / `src/AdminHome.jsx`): new · contacted ·
discovery · **meeting** ("נקבעה פגישה", between discovery and negotiating; its stage message defaults to `meeting_confirm`, off) · negotiating · won · lost · **nurture** ("לחזור בעוד כמה חודשים": moving a lead there sets a follow-up 3 months
out unless a future one exists — `updateLeadStatus`; its automation rule defaults to off) · **irrelevant** ("לא רלוונטי": its board column starts collapsed — a narrow drop strip,
every column can be collapsed and the choice is kept in `localStorage.afik_kanban_collapsed`; leads inside a collapsed column are announced above the board — "N לידים נמצאים בעמודות מקופלות: לא רלוונטי (37)" + "הצגת העמודות" (`.kb-hidden-note`, `KanbanBoard`) — so a project filter never looks like it lost leads; bulk sends leave these leads out
unless the stage is picked). **Call summary** (`CallNoteDialog`, "סיכום" on every board / mobile card, opened through `NoteCtx`):
outcome chips (talked / no answer / call back / not relevant), free text, next follow-up (tomorrow / 2 days / a week / any date) →
a note `{ id, text, ts, kind: 'call', outcome }` in `crm_data.notes` (the list the lead card shows) plus `followUp`, `lastCallAt`,
`noAnswerCount`; "not relevant" moves the lead to that stage, "talked" moves a new lead to contacted. The card shows the last note
and the follow-up (red when overdue).
**Campaign next to the name:** `leadCampaign(lead, lang)` (`src/lib/leadFields.js`, tested) — a short name: the Meta campaign
(else the form) through `shortCampaign()` ("זרובבל 15 - v2 (כוונה גבוהה)" → "זרובבל 15"), "אתר" for every website form, a one-word
label otherwise; `leadCampaignFull()` keeps the whole name for tooltips. Shown in brackets (inside `<bdi>`) after the name on the
board, the table, mobile cards, the call summary and the lead card. **Lead card → "הערות ופעילות"**: a composer (note / call /
meeting / WhatsApp; a call takes an outcome; the draft is kept in `localStorage.afik_lead_note_draft:<id>`) and one **history**
timeline grouped by day (filters: all / notes & calls / system): notes (edit inline, delete with a confirm), stage changes
(`crm_data.stageLog: [{ from, to, at }]`, appended by `updateLeadStatus` in `AdminPanel.jsx`), automatic WhatsApp sends
(`crm_data.auto.sent`), finished tasks, analysis, arrival, and the next follow-up on top (red when overdue). The card's
keyboard/focus effect runs once per open (it used to re-run on every parent render and pull the focus out of the note box
while typing); `EditInput` never overwrites a field that has focus; `save()` resolves to success/failure and shows "השמירה נכשלה".
**Welcome mark** (2026-10-26): every lead on the board shows whether the WhatsApp welcome went out — `WelcomeMark` in
`src/LeadsBoard.jsx` from `welcomeState()` (`src/lib/leadFields.js`, tested: `auto.sent.welcome` / `auto.sent['welcome:missed']` →
a green double check, `auto.welcomeFailed` → an amber "!", else nothing; the tooltip says when): an icon next to the date on a
pipeline card and after the name in the table, "✓✓ נשלחה" next to the stage on a phone card. A Meta lead's CRM copy gets the
welcome from the database: a trigger on `meta_leads.wa_sent` (`server/meta-welcome-crm-migration.sql`, applied 2026-10-26, which
also back-filled 37 copies from `automation_log`) writes `crm_data.auto.sent.welcome` — the copy used to keep the state it had
when it was made, so 13 welcomed leads showed nothing.
**Pipeline design (2026-11-03, a calm Apple-like system — `LB_CSS` in `src/LeadsBoard.jsx`, classes `.kb-col*` / `.lb-c-*`):** the
board is a quiet neutral (`--au-bg`), columns are faint tinted panels with no colored borders (the stage's color is a 9 px dot next to
the title, the count a soft grey pill, the fold arrow shows on hover), cards are white with a 1 px hairline, 14 px radius and a soft
shadow that lifts on hover, chips are quiet grey (the project chip keeps its color), the source is a dot + word, the note sits in a
tinted block, the footer actions and the checkbox appear on hover (always on touch), the collapsed column is a slim grey strip, the
hidden-leads note is a neutral card, "ליד חדש" is `.lb-primary` and the search a tinted pill that lights up on focus; the project bar's
tabs are borderless, the "פרויקטים ▾" button and the summary strip are hairline cards. Never hardcode a color on the board — use the
admin tokens (`--au-*`, `rgba(var(--ov), a)`, `rgba(var(--brand-rgb), a)`); stage colors only as dots / bars.
**Leads board look:** the view switch is a segmented control (תמונת מצב · פייפליין · טבלה, line icons); the toolbar is
"ליד חדש", search, then quiet `.lb-tb` buttons (sync, trash, CSV; columns / add column in the table only — the old dead
"סינון" / "מיון" buttons are gone). Pipeline cards are calm (initials avatar, name + phone, campaign / source / intent tags,
the message or property, the last note + follow-up, a footer with the date and icon actions; delete shows on hover) and every
card has a checkbox (`SelCtx`) that feeds the same selection and bulk bar as the table. Checkboxes are `CheckBox` (a real input
drawn as a rounded box — the admin's input reset hid the native ones), 60 px column in the table.
**Leads board tabs:** "תמונת מצב" (`src/LeadsDashboard.jsx`, a manager's dashboard following the dataviz rules — flat cards,
no gradients, one hue ramp for the funnel, blue / orange / aqua for sources): a filter row (period week / month / 3 / 6 months /
year / all / custom range, source, campaign — everything below follows it, compared with the previous equal period); "לידים
שנוצרו" (7 / 30 / 90 / 182 / 365 days, each vs the window before); KPIs (new leads, contact rate, median first response —
first human touch = a note that isn't 🔗 auto, a stage change or a call —, interested+, won / win rate, waiting > 24 h untouched);
the sales funnel (cumulative "reached" counts, step conversion, "now in stage", outcome tiles lost / irrelevant / nurture);
leads over time stacked by source (day / week / month buckets, hover tooltip, table view); campaign performance (rows open the
leads); pipeline health (days since last activity) and follow-ups (overdue / today / 7 days); an arrival heat map (weekday ×
3-hour band); and a drill-down list (sortable; call / WhatsApp / open) for any stage, bucket, follow-up group or campaign. The dashboard always counts the whole lead
list — the board's search box doesn't narrow it (it used to, silently: a search for one name made every number 1); a search
shows a note with "נקה חיפוש". A comparison window that starts before the first lead in the system shows "אין נתונים לתקופה
שלפני" (no fake "+100%"), and growth from zero reads "+N".
Pipeline, Table. **A click on a lead's name in the table opens the lead card** (`.lb-name-link`; ✎ on hover renames in place). The checkbox
column is one 60 px `.lb-selcol` for the header, every stage group's header (its color bar on the edge) and every row, the
checkbox centred in it (the drag handle sits on its edge), 18 px with a 2 px border; table links have `minHeight: 0` (the
global 44 px touch-target rule pushed the phone / email to the top of the row). **Table selection:** the checkbox column is pinned with `insetInlineStart` (RTL-safe — a `left: 0` pin used to
put it under the hover actions), the name column next to it; hover actions sit in a zero-width sticky slot at the inline end;
selected rows are tinted (`SEL_BG`) with an accent bar; Shift+click selects a range; "הצג רק נבחרים" filters the table to the
selection. **Selection & bulk:** every table row has a real
checkbox (controlled by `selectedIds`), each stage group and the header select all; the bar offers select-all, move to a stage,
merge (2 selected) and delete (asks once, leads go to the trash). **Undo & restore** (2026-10-25): a delete removes the row from `contacts`; the
admin keeps the whole lead in this browser's trash (`LEADS_TRASH`). Right after a delete (one or a bulk) a bar at the bottom says
"נמחקו N לידים · **בטל**" for 20 s (Ctrl / ⌘ + Z too; `undoDel` in `AdminPanel.jsx`). Undo and the trash's "שחזר" / "שחזר את כל ה-N"
(the trash is grouped by deletion — `trashBatches()`) go through `restoreLeads(ids)` → `POST /api/contacts?restore=1 { leads }` (admin):
`restoreRow()` (`lib/lead-restore.js`, tested) rebuilds **the same row** — id, `created_at`, stage, notes, tasks, form answers — as an
upsert on id, so a restore is never a new lead (no new-lead email, no WhatsApp welcome, no automations; the old restore re-POSTed it as
a new website lead and lost everything in `crm_data`). It waits for a DELETE still on its way, and a Meta lead's copy that the daily
`crm-sync` already copied again (same `metaLeadId`, new id) isn't restored twice (`existing` in the answer; the old id is dropped). **Merge** (`src/lib/leadMerge.js`, tested — `mergeLeads()` /
`mergeConflicts()`): from two selected rows or by holding a dragged Pipeline card on another card for 0.65 s ("שחרר כדי למזג");
`MergeDialog` picks the lead that stays and the values for conflicting name / phone / email; notes, tasks, tags, form answers,
stage history, the other message and `mergedFrom` are kept, then the other lead goes to the trash (nothing is deleted if the save
fails). Pipeline cards no longer shift while dragging (`NO_SHIFT` — the order in a column isn't saved). Meta form option codes read
as words (`prettyAnswerValue` / `prettyLeadText`: "3r" → "3 חדרים", "b34" → "3–4 מיליון").

**Projects (deals)** (2026-11-03, `lib/projects.js` + `lib/manual-lead.js`, tested; UI `src/LeadProjects.jsx`, list
`src/lib/projectsStore.js`): the properties / projects run in parallel — `{ id: 'p_…', name, color, town, status: active | archived,
aliases }` in `app_settings.lead_projects` (`GET / POST /api/meta/projects`, the server merges by id; deleting needs `removed`). A
lead's project = the one it was put in by hand (`crm_data.projectId` + `projectName`; `__none` = taken out) else the project whose
name / alias matches its campaign short name or listing (`projectOfLead()`; an archived project takes no new ones). `projectName`
is also what `leadProject()` / `leadProperty()` return, so `{property}` in the messages and "+ הוספת הפרויקט" follow it. The leads
board has a **project bar** — a **"פרויקטים ▾" dropdown** with every project in one list (search, ↑ ↓ Enter, "כל הלידים", each
project's town, leads, open and stage bar, "בלי פרויקט", + new, manage — `ProjectsDropdown`), then the 5 busiest as tabs (+N opens
the list); **campaigns become projects by themselves**: a campaign / listing with ≥ 3 leads that no project covers is created once
(`autoProjects()`, tested; the names are kept in `app_settings.lead_projects_auto`, so a deleted one never returns; a Meta copy's
`prop_title` reads as the short campaign name — "זרובבל 15 - v2 (כוונה גבוהה)" → "זרובבל 15"); **merging duplicates** ("ניהול
פרויקטים": "נראה כמו אותו פרויקט — כדאי למזג?" groups by the name without numbers / signs — `duplicateGroups()` —, or tick cards → "מיזוג"):
pick the name that stays or type one; `mergeProjects()` (tested) keeps one project with every merged name / alias as its aliases (new
leads from those campaigns join it by themselves) and `POST /api/meta/projects { …, removed, merge: { from, into } }` moves the leads
put by hand in a merged-away project (`crm_data.projectId` / `projectName`); the choice filters the
pipeline, the table, "תמונת מצב" and the follow-ups, `localStorage.afik_lead_project_filter`, plus a summary strip with the stage
bar); **a colored project chip** on every pipeline card, phone card, the table's "פרויקט" column and the lead card's details — a
click opens a picker (search, "בלי פרויקט", type a new name → create); the bulk bar's "שיוך לפרויקט"; **"ניהול פרויקטים"** (cards
with leads / open / the stage bar, edit name / town / color / campaign names, archive, delete — the leads stay —, and "קמפיינים בלי
פרויקט" → create from one). **"ליד חדש" is saved on the server now** (it used to add a row in this browser only): a dialog — name,
phone / email (one is needed), project (the bar's project by default; `ProjectSelect`: search, or type a new name → created), stage (the column's), where from (phone call / referral /
walk-in / website / Facebook-Instagram / Yad2 / other + details), a first note, "לשלוח הודעת פתיחה" (off) → `POST
/api/contacts?manual=1` (admin) → `manualLeadRow()` (source `manual_<from>`, `crm_data.origin.channel = 'manual'`), no new-lead
email / office WhatsApp, the welcome only when ticked.
**The lead card, resizable and in the same calm design** (2026-11-03): the header is `.lc-head` (a soft avatar, the name 20 px
semibold, the campaign quietly after it, the stages as `.lc-stage` chips — a dot per stage, the current one filled —, quiet
hairline action buttons `.lc-act.quiet` with the channel's color only on the icon, one filled `.lc-act.primary` for the analysis,
`.lc-ib` icon buttons), tabs 14 px with a count pill, sections as hairline cards (16 px radius), 40 px inputs. **Sizing:** the
chat column's edge is a visible grip (`.lc-grip`, `Splitter` x — drag it, double-click resets), the chat's bar (`.lc-rail-bar`) has
width presets צר · חצי · רחב (`setConvWidth` → `--lc-conv`, kept in `afik_lead_card_conv_w2`) and ⤢ **"השיחה על כל הכרטיס"**
(`chatMax` → `.lc-body.chatmax`, one grid column; Esc or the button bring the details back), **"מקור הליד" never shrinks the chat**: it is a one-line summary by default (`afik_lead_card_info_v2`, '1' = open) and opens as a panel floating over the top of the conversation (`.lc-side.is-open`, ✕ / the ⓘ in the chat's bar closes it), so the chat keeps the whole column; the header's ⤢ puts the whole card on the screen (`cardFull`, `afik_lead_card_full`). **Phones** (≤ 640 px): the stages scroll in one row, the actions are a two-column grid with ✕ pinned to the corner, the conversation tab fills the screen (`calc(100dvh - 260px)`), one grid column with `minmax(0,1fr)` so nothing overflows.
**The lead card is wide and always shows the chat** (2026-11-03): up to 1800 × 1080 px; on a screen ≥ 1040 px its side column
holds the lead's source / details on top (a fold line, `localStorage.afik_lead_card_info`) and the whole WhatsApp conversation
under it with the message box (`LeadConversation`), next to every tab — details, notes & activity, tasks… (`afik_lead_card_conv_v2`,
on by default; the column drags, `afik_lead_card_conv_w2`); narrower screens get the conversation under the notes and in the chat
tab. Bigger tabs (48 px, 15 px) and fields (42 px, 14.5 px).
**Lead card → "שיחת וואטסאפ"** (`src/LeadChatTab.jsx`): the whole WhatsApp conversation with the lead, read-only (`chat-history`,
200 messages, normalized by the pure `lib/chat-format.js` `normalizeChat()` — voice notes / media shown as markers), and an
**AI summary** = `POST /api/meta/chat-summary { lead }` (`lib/chat-summary.js`, tested; Claude `claude-opus-5-5`, structured
output, `fallbacks: 'default'`): summary, what the lead wants, topics, what was agreed, open questions, next step, suggested stage
(one click → `onUpdateStatus`), follow-up in N days (one click → `followUp`), temperature, who wrote last ("הליד מחכה לתשובה",
also a "!" on the tab). Stored as `crm_data.chatSummary` (with `msgCount`, so the tab says how many messages arrived since);
"שמור כהערה" adds it to `crm_data.notes` (kind `wa`). Voice notes are counted but not transcribed (Claude reads text, not
audio). The Claude call itself is `lib/claude-json.js` `claudeJson()` (key / admin-key / workspace handling), shared with the lead
analysis.

Analysis = `POST /api/meta/lead-analyze { lead }` (`api/meta.js` → `lib/lead-analyze.js`): builds a dossier (lead + crm_data,
WhatsApp history from Green API, `automation_log`, repeat inquiries in `contacts` / `meta_leads`, the matching listing from the
property catalog), scores it with the pure, tested rules in `lib/lead-intel.js` (0–100 with signed, explained factors, missing
info, next best action) and asks Claude (`claude-opus-5`, structured output, server-side refusal fallback) for a briefing that
may adjust the score by ±15. The result is stored as `lead.enrichment` (`version: 2`, `score100`, `grade`, `factors`, `brief`, plus
the legacy `score` 1–5 / `intent`). Without `ANTHROPIC_API_KEY` in Vercel the endpoint returns the dossier and the panel runs the
briefing through the Render AI proxy, merged with `mergeBrief()`. A key created outside a workspace gets a 400 ("not scoped to a
workspace"): create the key inside a workspace, or set `ANTHROPIC_WORKSPACE_ID` (sent as the `anthropic-workspace-id` header).

**Prospect research (SDR step):** before the briefing the panel calls `POST /api/meta/lead-research { lead }` (`lib/lead-research.js`):
Claude with the web search server tool checks the phone number (Israeli numbering plan: mobile / landline / VoIP, carrier, made-up
digits — `phoneCheck`, tested), the name (`nameQuality`: full / first-only / test-looking), and who the person is from public
sources (LinkedIn / Facebook / Instagram / company site / listings / directories), plus real-estate-professional signals, red flags,
rapport hooks and gentle verification questions. Rules live in `RESEARCH_SYSTEM`: public information only, no sensitive categories,
a match only when two independent signals agree, every claim with its URL (`normalizeResearch` drops the rest). The result is passed
into `lead-analyze` (`research` in the body → `researchText` in the dossier) and stored as `enrichment.research`; the briefing schema
carries `identityCheck`, `rapportHooks`, `openingLine`, `warmUpPlan`. The card shows it as "מי הליד — אימות ומחקר". Each step has
its own time budget (the research loop resumes `pause_turn` up to 4 times within ~48 s, `max_uses: 8` searches).

### Property share links (`/p/<id>`)

Every property has a short share link `https://afikhanahal.co.il/p/<id>` (`vercel.json` rewrite → `api/properties.js?share=<id>`,
rendered by the pure, tested `lib/share-page.js`). Link-preview crawlers (Facebook / Instagram / WhatsApp / LinkedIn / X / Telegram…)
get an HTML page with the property's Open Graph tags (title · place, price · specs, first photo as a 1200×630 JPEG from the image CDN, JSON-LD); people get
an instant 302 to `/?p=<id>#properties`, keeping `utm_*` / `fbclid` / `gclid` / `lang`. Hidden or missing properties get the
generic preview. The site's own share button uses the same link, and the landing UTM is kept for the whole session
(`sessionStorage.afik_utm`) so `crm_data.origin.utm` credits the ad even after browsing.

**Source of truth = the Supabase `properties` table** (`lib/property-store.js`, tested): Render keeps the list in RAM and its own
write to that table has been failing silently since June (properties saved since then lived in Render's memory only and would
vanish on a restart). So the site side fills the table itself: every admin save / delete is mirrored through Vercel
(`POST /api/properties?upsert=1` · `?remove=<id>`, `src/siteRebuild.js` `mirrorProperty` / `mirrorDelete` — while Render is
down that *is* the save), the intake "פרסם באתר" writes the table first (Render best-effort, 8 s), and `feed.reconcile()`
(after every change, daily, at deploy) copies into the table whatever Render or the last snapshot has that it lacks (never
overwrites). Render re-reads the table every 5 minutes, so it follows. Property ids are numeric (`Date.now()`; the key is a
BIGINT — never `intake-…` strings).

**Speed (Render sleeps on the free tier):** the public list (`/api/properties` without a token) comes from `lib/property-feed.js`
(tested): the `properties` table first (published rows, 3 s budget, no Render bandwidth at all; the admin fallback `feed.getAll()`
includes hidden ones), then Render if it answers within 2.5 s, otherwise a snapshot kept in Supabase `app_settings` (key `public_properties`,
rewritten only when the list changed; refreshed by `api/cron/warm.js` too), and as a last resort `dist/properties.json` — the
published list written at deploy time by `scripts/build-properties.mjs` (Vercel builds only; also seeds the snapshot). First-time
visitors paint the grid from that static file (`index.html` starts it as `window.__afikList`) and the live list replaces it; an
open property window always follows the freshest data. So the site never waits on a cold start.
**When Render is down for real (suspended, crashed — `x-render-routing: suspend-by-user`):** the snapshot is all the site has.
`GET /api/properties?health=1` (public, no secrets) says what is being served (`serving`: table / render / snapshot / static / none,
Render's status + routing, snapshot age and size); the admin home shows it as the "שרת הנכסים (Render)" tile (red = no data
anywhere → resume the service on Render). The admin panel offers its own copy of the list with `POST /api/properties?snapshot=1`
(`src/siteRebuild.js` `pushSnapshot`, on every admin load; only published properties): the server stores it only while Render
can't answer for itself (`feed.pushSnapshot`, tested), and every good admin read through Vercel refreshes the snapshot too. The
deploy (`scripts/build-properties.mjs`) falls back to the previous deploy's `properties.json` on the live site, so a build never
erases the static pages. The dev sandbox cannot reach the production domain: measure the live site with the "Site speed probe"
GitHub Action (`scripts/probe-site.mjs` — timings, edge-cache headers, landing-page markers, backend health, a phone-profile
browser visit on the real network and on Fast 3G, screenshots at 1/3/6/10 s in the run's artifact).
`/api/properties?one=<id>` returns a single published property (snapshot first); `index.html` starts that request for
`/?p=<id>` before the bundle loads (`window.__afikShared`) and `App.jsx` opens the property as soon as it arrives, with a
"טוען את הנכס…" overlay meanwhile. Crawlers on `/p/<id>` use the same fast lookup. The map in the property window sits in
its own `SectionBoundary`, so a failed map chunk never takes the page down.

**Instant landing pages (property visible in < 1 s on any phone):** `/p/<id>` is a real HTML page with the property already
drawn (photo, title, price, specs, WhatsApp / call) and its own Open Graph tags, so it paints with no JavaScript; the full site
(same `index.html` + bundle) loads underneath and takes over — `App.jsx` opens the property window with the embedded data
(`window.__afikShared`, `fresh` = the live re-check) and then fades the `#afik-pre` layer out. Rendered by `renderLanding()` in
`lib/share-page.js` (tested): at deploy time for every published property (`dist/p/<id>/index.html`, served by the CDN before
the rewrite) and by `api/properties.js` for newer ones (edge-cached for everyone, `s-maxage=60, swr=1d`). Saving / deleting
a property (admin panel, wizard, "פרסם באתר") calls `POST /api/properties?changed=1` (batched 15 s, `src/siteRebuild.js` →
`lib/site-rebuild.js`, tested): it refreshes the snapshot at once and, when `VERCEL_DEPLOY_HOOK_URL` is set, rebuilds the site
(max once a minute) so the static pages follow.
The landing page is tuned for a slow phone: a responsive photo (`srcset` 480/900/1400 through the image CDN, preloaded
after the viewport meta so the preload and the `<img>` pick the same size), an inline blurred placeholder (`__lqip`, a
24px JPEG fetched at build time; `SKIP_IMAGE_WARM=1` skips the CDN warm-up + placeholders), a lean head (no org JSON-LD,
no `#root` fallback text, no stray preconnects) and **photo-first loading**: the app's JavaScript starts (`afikBoot()`,
inert `afik-modulepreload` links + an `afik/module` placeholder script) only after the photo has arrived or 1.2 s; GTM /
GA4 and the property list download wait until the site is up (`window.__afikLanding`). Inside the property window the
GovMap SDK loads only when the map is within ~800px of the viewport, and the city photos on the homepage only when their
cards are near.

**Homepage static first screen:** `scripts/build-properties.mjs` also writes the hero and the property grid into
`dist/index.html` as a plain-HTML layer (`#afik-pre-home`, `lib/home-page.js` `renderHome()`, tested), so a first-time
visitor sees the real first screen with the HTML (~0.4 s) instead of after the bundle (1.1–2.1 s). Both languages are in
the markup (`data-pre-lang`); an inline script shows the layer only on `/` (never on `/admin-panel`, `/sell`, an old
`/?p=` link). Cards link to the instant pages `/p/<id>` and use the same cover URL as the app's cards (`cardImage()` =
`thumbImg`), so nothing downloads twice. `App.jsx` fades the layer out once it has rendered (a reader who had scrolled the
layer's grid lands on the real `#properties`). The layer's hero / properties texts come from `content/home.json`, the
same source as the app (see "Homepage content"). The landing pages are rendered from the plain template first.

Admin → property list → "שתף" (or ⋯ → "שיתוף ופרסום") opens `src/PropertyShare.jsx`: the link with a live preview, per-channel UTM
links (Facebook, Instagram, WhatsApp, colleagues, Yad2, Google; `utm_campaign=prop-<id>`), a custom UTM builder, ready-made post and
colleague texts (Hebrew / English), one-tap share buttons, a QR code generated in the browser (`qrcode`) and a Facebook debugger link.

**The office's new-lead email** (website forms in `api/contacts.js`, Meta leads in `api/meta.js`) is one shared template, `lib/lead-email.js` (tested): a 680 px card, contact details as short rows, then the message in its own full-width block — a form's "question: answer · question: answer" text becomes one line per answer (`messageParts()`), long answers in regular weight; everything the visitor typed is HTML-escaped and `dir="auto"` (an English message reads left-to-right); `page_<type>_<slug>` sources read as "עמוד באתר · …". **One font everywhere** (Gmail / Outlook drop `<body>` styles, so every element carries `font-family` — the heading used to come
out in a serif). **A Meta lead's email says what they asked about and what they filled in:** "התעניינו ב" (the campaign's short
name) and "מה מילאו בשאלון" — every form question with its answer (`metaFormAnswers()` → `cleanAnswers()`: Meta's
"?כמה_חדרים" / "5_מיליון_וצפונה" written as words, `inbox_url` and test values left out); the office's WhatsApp alert (webhook and
sync) lists the same answers.

## Render bandwidth budget (free tier: 5 GB / month — the site was suspended once for exceeding it)

Render meters every byte it sends. Rules that keep it near zero:

- **The public site never calls Render directly.** Visitors get the property list, `/api/stats` (edge-cached 10 min)
  and everything else through Vercel; only an admin session (`sessionStorage.afik_admin_session`) talks to Render.
  The CRM webhook for a new lead is forwarded by `api/contacts.js` (reads `site_config.admin_settings` server-side).
- **Vercel asks Render conditionally.** The snapshot keeps Render's `ETag`; `lib/property-feed.js` sends
  `If-None-Match`, an unchanged list answers `304` with no body. A snapshot must therefore exist: it is stored in
  `app_settings`, or in `site_config` when that table is missing (health `store.table` says which).
- **Server code that needs the catalog uses the feed** (`lib/lead-analyze.js`), never a raw full-list download.
- The admin panel polls Render with `If-None-Match` (`condFetchJson`) and pauses in hidden tabs — keep it that way.
  The WhatsApp chat reads the legacy Render history once per contact per session (`GreenAPIChat.jsx`); its 8-second
  poll asks only Green API through Vercel. Photos never go inline (base64) into a property: the admin uploader falls
  back to the wizard's signed-URL upload to Supabase Storage and otherwise shows an error.
- **Inline photos (automatic):** photos stored inside a property as base64 are the single biggest cause of the overage
  and of slow loads (the live list was 1.9 MB for 10 properties, 17 inline photos). Four layers keep them out:
  1. every admin save (`saveProp` / `savePropSilent` / bulk sync / the wizard) first runs `externalizeInlinePhotos`
     (`src/inlinePhotos.js`): data-URL photos are uploaded through the wizard's signed URL (Supabase Storage, no Render)
     and replaced by their URLs; the wizard's logo is uploaded too;
  2. `POST ?changed=1` (after every save) runs `slimInlinePhotos` (`lib/slim-photos.js`, on top of the tested helpers in
     `lib/inline-images.js`): anything inline left in the `properties` table moves to
     `property-images/inline/<id>/<sha1>.<ext>`, straight through the table, so it works while Render is down;
  3. `api/cron/warm.js` runs the same every day;
  4. the admin home runs it by itself when `health.list.inlineImages > 0` (and `POST ?slim=1` runs it on demand).
  The list the site serves does not always come from that table (it was Render's list / the admin's copy in the
  snapshot, and the table Vercel reads held none of the 17), so the **list itself** is cleaned too: every feed that
  stores a list (`createFeed({ transformList })` in `api/properties.js`, `lib/site-rebuild.js`, the cron, the build)
  runs `slimList` (`lib/slim-photos.js`, tested — content-hashed, HEAD-checked, never uploads twice) before writing,
  `feed.cleanSnapshot()` cleans a snapshot stored before this (hash kept, so Render isn't re-downloaded), and the
  build cleans the deploy-time list and static pages. Render's own database is cleaned by the admin panel: once per
  session it re-saves any property that still has inline photos (upload first, then PUT with URLs).
  The Render server itself (`afik-hanahal-server` repo) should also stop writing base64 — none of this depends on it.
- **Meter:** the feed counts every byte Render sends to Vercel (`render_traffic` in the store, per month) and
  `health` reports it with the list's weight and inline-photo count; the admin home shows both as the "רוחב פס Render"
  tile (warn > 1.5 GB, red > 3.5 GB; warn on a heavy list or inline photos). Render's own number is on
  dashboard.render.com/billing → Included Usage; the meter sees only what goes through Vercel (not the admin panel's
  direct reads), so treat it as a floor.
- Check with the "Site speed probe" action: the "backends" section shows the list size and whether `If-None-Match` gets a 304.

## Supabase egress budget (free plan ~5 GB / month — the project was restricted on 2026-10-18 at 6.26 GB)

While restricted, every Supabase request answers `402` until the quota resets (Nov 6): the property list falls back to
Render / the snapshot / the static `properties.json`, new leads are kept in Vercel Blob (`lib/backup.js`) and still emailed /
WhatsApped to the office, and photos load only where the image CDN already cached them. Upgrading to Pro lifts it at once.
What used the bandwidth (edge logs): **videos** (a 43 MB property video downloaded again and again by our own "Site speed
probe" phone visit, because the property window loaded every video for its thumbnail), **oversized photo originals**
(5.5 MB PNG / 1–12 MB JPEGs that wsrv.nl fetches once per size and edge location) and Meta's crawler. Rules:

- **No video byte before the visitor presses play.** The property window shows a still (the video's thumbnail, else the
  first photo) with a play button; `playIdx` decides when the `<video>` mounts (`preload="auto"` only then). Thumbnails
  never use `<video preload="metadata">`. Other video players use `preload="none"`.
- **Photos are small at the source.** Uploads are compressed in the browser (1600 px JPEG) and sent with
  `cache-control: max-age=31536000`; `lib/shrink-photos.js` (tested) re-encodes any older original over 450 KB in place
  (same path, so every link keeps working; ≤1600 px JPEG through the CDN; 1-year cache) — daily in `api/cron/warm.js`, on
  demand with `POST /api/properties?shrink=1`; photos that don't get smaller are remembered in `app_settings.photo_shrink`.
- **Automated browsers never download media**: `scripts/probe-site.mjs` aborts video requests.
- Keep server reads narrow: never `select=*` on `contacts` / `meta_leads` in a poll; the full lead list (~310 KB) is read only
  by the automation run.
- Measure with the Supabase edge logs (MCP `query_logs`, `source = 'edge_logs'`, sum `response.headers.content_length` by
  `request.path` / `request.cf.asOrganization`) and Usage in the Supabase dashboard.

## Vercel Fast Origin Transfer budget (free tier: 10 GB / month — 75 % was used in the first days of October 2026)

Vercel meters every byte a **function** sends to its edge (static files in `dist/` are a separate, much larger allowance).
Rules that keep it near zero:

- **Photos never go through a function.** `lib/img-url.js` (tested, shared by `src/App.jsx` `cloudImg`/`thumbImg`, the
  static homepage layer `lib/home-page.js` `cardImage` and the landing / share pages `lib/share-page.js`) sends every
  Supabase photo through the image CDN wsrv.nl **straight from Supabase** (`?url=<supabase public url>&w=600|1200&…webp`;
  og:image = 1200×630 JPEG). The old `/media/<bucket>/<path>` proxy (`api/properties.js?img=`) streamed full-size
  originals (100 KB–5 MB each) through a function on every edge miss; it is kept only for old links. Never point
  `<img>`, wsrv or og:image at `/media` again. `.map(cloudImg)` passes the index as the width — always `.map(u => cloudImg(u))`.
- **Every JSON answer is gzipped with an ETag**: `api/meta.js`, `api/seller-form.js`, `api/contacts.js` call
  `compressJson(req, res)` (`lib/http.js`, tested) at the top, so `res.json()` = `sendJson()` (gzip, ETag, empty 304 on
  `If-None-Match`, GET or POST). Other functions use `sendJson` directly.
- **Admin polls are conditional**: `condFetchJson` (contacts, properties), the WhatsApp chat's 8-second `chat-history`
  poll and 30-second `chat-list` poll send `If-None-Match` and get a 304 while nothing changed (`src/GreenAPIChat.jsx`).
  New polls must do the same, pause in hidden tabs, and not be shorter than they need to be.
- Public endpoints are edge-cached (`s-maxage`), including their error answers (`api/stats.js`), so a visitor never
  runs a function per page view.
- **Deployments:** Hobby allows 100 deployments a day (preview + production + deploy hook). Pushes to the `claude/*` work
  branches build no preview (`vercel.json` `git.deploymentEnabled`) — on 2026-10-19 previews were 68 of the 100 and production
  deploys were refused ("Deployment rate limited — retry in 24 hours"); the probe's `rebuild` action redeploys once the
  window frees up.
- **Deployment Storage (Hobby: 10 GB, every kept deployment counts; ~75 % on 2026-10-19 after ~210 previews + ~105 production
  deploys in 30 days).** Hobby is never billed for it: past 10 GB Vercel deletes old unprotected deployments at once and may
  block new deploys until space frees up. Keep the count low: no previews for `claude/*`, one production deploy per merged
  change, and the deploy hook (`lib/site-rebuild.js`, tested) rebuilds only when the published property list's hash differs
  from the last rebuild's, at most once every 2 hours (the daily cron catches a change that waited; the probe's `rebuild` sends
  `force=1`). In the dashboard: project → Settings → Deployment Retention → preview / canceled / errored 1 day, production 1
  week (the current production deployment is always kept).
  **75 % again on 2026-11-02 (team `afik-hanahal-s-projects`, ~4 production deploys a day, nothing deleted).** Two guards since:
  `.github/workflows/vercel-cleanup.yml` (daily, `scripts/vercel-cleanup.mjs` + the tested rules in `lib/vercel-cleanup.js`
  `pickDeletions()`: keep the 5 newest ready production deployments and everything from the last 7 days, previews / errored /
  canceled go after a day, never one still building; counts only in the log) — it needs the `VERCEL_TOKEN` secret (vercel.com →
  Account Settings → Tokens, scope = that team; optional variables `VERCEL_TEAM_ID` / `VERCEL_PROJECT`) and does nothing without it;
  and `ignoreCommand` in `vercel.json` (`scripts/vercel-ignore.sh` — Vercel caps the command at 256 characters; a longer one failed the deploy) skips a deploy for commits that only touch docs / `*.md`, `server/*.sql`, `studio-pack/`,
  tests and the probe / cleanup scripts. Batch small changes into one PR when you can — every merge is a kept deployment.
- Measure with the "Site speed probe" action, `actions: traffic`: wire size, gzip and the 304 of every API answer, and
  the photo sizes through the CDN. Usage itself: vercel.com → the team → Usage → Fast Origin Transfer.

## GovMap parcel map (`src/GovMapWidget.jsx`)

The property modal and the property wizard show a GovMap map zoomed to the property's gush/helka. The parcel point
is resolved server-side by `GET /api/properties?parcel=<gush>-<helka>` (`lib/parcel-locate.js`, tested), which asks
several GovMap sources in parallel (new-platform parcel WFS, open-data `Parcels_ITM` WFS, the new search autocomplete,
legacy TldSearch) and answers with the first one that finds the parcel, in ITM, Web Mercator and WGS84; hits are cached on
the CDN for a month. The widget starts that lookup on mount (in parallel with the SDK download), caches it per page and in
`localStorage` (`afik_gm_parcel_v1:<gush>-<helka>`), and opens the map directly on the parcel (`center` / `level`) when the point is known. The
widget zooms with `govmap.zoomToXY` (ITM, level 13), verifies the landing through the map's `EXTENT_CHANGE` events
(switching to Web Mercator / level 10 if the SDK didn't move), and always shows a status chip (locating / shown /
not found + "פתח ב-GovMap" + retry) instead of failing silently. The legacy `es.govmap.gov.il/TldSearch` service
alone is no longer relied on.

## Public site performance rules (keep scrolling smooth on slow phones)

Measured on a mobile profile (CPU ×4): the homepage used to burn ~40% CPU at rest and scroll at ~12 fps. What fixed it,
and what must not come back:

- **No page-level React state that changes on scroll or on a timer.** The hero parallax moves its blobs through refs
  (`parallaxRefs`, one rAF per frame); the active nav item is a ref (`activeNavRef`) that toggles classes directly; the
  typewriter is its own `<Typewriter>` component (and pauses off-screen). `App` re-rendering re-creates the whole page.
- **Heavy sections and `PropertyCard` are `memo`-ized**, the site `ThemeCtx` value is `useMemo`-ed (`siteThemeValue`) and
  their callbacks are stable (`useStableFn`: `openContactStable`, `openPropertyStable`). Keep new props stable too.
- **Animations: `transform` / `opacity` only** (compositor). No infinite `box-shadow` / `text-shadow` / `background` /
  `filter` animations (the WhatsApp pulse is a `::after` ring, `SectionBadge` is a rotating conic gradient in CSS). No
  `backdrop-filter` on things that scroll in numbers (property cards) or on the opaque navbar. SVG SMIL animations run only
  while visible (`useSvgAnimationsWhenVisible`).
- **framer-motion is not used on the public page** (it stays in `SellerForm`, its own chunk); `qrcode` is admin-only
  (`vendor-qrcode`). Check `dist/index.html`'s preloaded chunks after adding a dependency.
- `.prop-card` has `content-visibility:auto` (off-screen cards aren't laid out / painted).
