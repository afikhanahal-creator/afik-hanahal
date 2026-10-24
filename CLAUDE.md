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
chats and `meta_leads` follow. A name that already carries the project drops the "(campaign)" after it (`leadCampaignTag()`). The phone's own
WhatsApp contact book can't be edited through Green API. **Pipeline stage from the chat:** the lead header's "שלב בפייפליין" menu (`PIPELINE` in `MetaLeadsTab.jsx`,
the office's renamed stage names through `stageLabels`) moves the lead's CRM copy through `onCrmStage` → the admin's
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
lead or junk stays as typed). The name as typed stays in `raw_fields` / `crm_data.originalName`, and an English message greets
with it (`renderTemplate`). The existing leads were converted on 2026-10-24 (164 contacts, 178 Meta leads). **Safety net:** `auto-tick` (every 15 min) and the panel's `auto-run` also convert any lead of the last 72 h still named in Latin, in both tables (`lib/hebrew-lead-names.js` `hebrewizeRecentNames()`, tested — `crm_data.originalName` keeps the typed name). every screen shows the lead's current name from the admin's `leads` (kept fresh by the change bus) over a
copy it got earlier — "היום" in the automations (queue rows and the schedule; a message not edited by hand is re-rendered with the
new name), the automations log, the meetings tab (`BookingAdminTab` gets `leads`, a call shows its lead's name via `leadId`), the
chats (lead name over the WhatsApp name) and the Lead Center (the server renames `meta_leads` too).
**One list of notes everywhere** (`src/lib/leadNotes.js`, tested): the CRM lead's `crm_data.notes`. The Lead Center's notes card (it used to be a free-text field on `meta_leads.notes`, seen nowhere else) adds to that list through `onCrmPatch` → the admin's `updateLead` on the lead's CRM copy (`ensureCrmCopy` makes one first, like the pipeline menu); the old Meta note joins the list once (`meta_note_<id>`). The chats tab's header has "הערות" (`NotesButton`) and "פולו אפ" for the open chat's CRM lead (`onUpdateLead`); "צפה בליד" opens that lead's card (`/admin-panel/leads?lead=<id>`, read by `LeadsBoard`).
**Follow-up tasks with a WhatsApp reminder** (`lib/follow-up.js`, tested; UI `src/FollowUpTask.jsx`): `crm_data.tasks` items `{ kind: 'followup', due (ISO), remind, remindedAt }`; the lead's `followUp` (Israel-local "YYYY-MM-DDTHH:mm") follows the earliest open one (`addFollowUp` / `updateTasks` / `setNextFollowUp`). Written from the lead card (tasks tab "פולו אפ – לחזור אליהם", the header's bell button, the details field "follow-up"), the call summary ("תזכורת בוואטסאפ כשמגיע הזמן", on by default), the Lead Center (header button + aside card) and the chats header. Quick picks (`followUpPresets`: in 1 h / 3 h, today 17:00, tomorrow 9:00 / 14:00, 2 days, a week, a month — Saturday moves to Sunday). **No polling for reminders:** the database's own scheduler (pg_cron, every minute, inside Postgres — no transfer, no function call) counts the due ones (`public.afik_due_reminders()`) and only when there is one calls `POST /api/meta/auto-remind` (pg_net) with the key it keeps in `app_settings.remind_key` (made in the database, never in code or chat; compared in constant time); a reminder refused 3 times gets `remindGaveUp` and stops being due; `afik-cron-cleanup` trims the scheduler's log daily. `remindTasks()` (`lib/automations.js`) reads only the leads with tasks (`crm_data->tasks`), sends each due reminder once to the office number (`TEAM_CHAT`, one of the numbers Green's free plan still allows) — name, task, campaign, phone, when, wa.me and the card link — and marks it (`app_settings.task_reminders` keyed lead · task · due, 3 tries, `remindedAt` on the task); a moved task reminds again, one more than 24 h late is skipped. **Plain tasks remind too** (2026-10-24): the tasks tab takes a date + time (`format="iso"`, the follow-up quick picks) and a
"תזכורת בוואטסאפ" switch (on) → `{ kind: 'task', due (ISO), remind }`; the reminder reads "תזכורת למשימה: <full name>" with the
task, the project (`על:`), what they look for (`מחפשים:` — `leadNeeds()` from the lead card's fields / form answers), the phone,
wa.me and the card link `/admin-panel/leads?lead=<id>`. `public.afik_due_reminders()` counts every task with `remind` (it used to
count follow-ups only) and reads an old Israel-local due in Israel time (`server/sync-bus-migration.sql`).
**Date / time picker** (`src/DateTimePicker.jsx`): every admin date field (lead card follow-up and task due, call summary, the leads dashboard's custom range, bulk-send scheduling) — quick picks, a month calendar (Sunday first, RTL, today marked, arrows / PageUp / PageDown / Home), time chips 07:00–21:00 + any time typed, formats `date` / `local` / `iso` (Israel time); a bottom sheet on phones. `Popover` (automationsUI) ignores clicks inside the picker's portal, and both call `preventDefault` on Esc so the lead card under them stays open.

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
group header has "נוסח לכל הקבוצה…". The send carries the chosen `templateId`. The built-in library has 61 bilingual templates
(welcome / late-welcome / investor / scheduling variants, follow-ups, visits, after-call, nurture, re-engagement, chat-ready
replies, deal steps), **written by people, from the Afik Hanahal page**: always plural — the office is "we" ("ראינו",
"נשמח", "נתקשר") and the lead is addressed in plural ("השארתם", "לכם", "אתכם"), which also keeps the Hebrew gender-neutral; the
message opens with **why we write and what the lead asked about** — the project / listing (`{property}`), when and where they left their details (`{when}` / `{where}`) and, when known, what they look for (`[[ הבנו שאתם מחפשים {needs}…]]`) — not with the office: "היי רונן, ראינו שהשארתם פרטים אתמול במודעה על זרובבל 15. הבנו שאתם מחפשים 4 חדרים, בתקציב של 3–4 מיליון…" (a lead whose project / listing we know — a Meta lead's campaign counts — gets the rule's project welcome, `welcome_prop`, through `welcomeTemplateId()` in `lib/automations-shared.js`: the automatic send, the Lead Center's first text and the missed-welcome queue; it never names the office — the project says who we are). "אפיק הנחל" appears in at most 4 templates (a first message without a project, a late one, the months-later re-engagement, the review request), once, never as the opening words (test "every message is about the lead"); `{property}` / `{needs}` sit inside `[[ … ]]` wherever the sentence reads fine without them, so a lead with no project gets no generic "הנכס"; the lead analysis' suggested message (`lib/lead-analyze.js`) follows the same rules; later ones carry no signature (`{agent}`, default
"צוות אפיק הנחל", only signs the closing / holiday messages, inside `[[ … ]]` so an empty value drops the line); "היי" (or `{greeting}`: `timeGreeting()` = בוקר טוב / צהריים טובים / ערב טוב by the Israel hour, rendered at send
time) instead of "שלום … תודה על פנייתך"; the welcome says what a person would know — `{when}` (`leadWhen()`: היום / אתמול /
ביום שלישי, '' after a week) and `{where}` (`leadWhere()`: במודעה for Meta leads, באתר for website forms) — "ראיתי שהשארת פרטים
אתמול במודעה על זרובבל 15. אפשר להתקשר אליך לכמה דקות?"; 1–3 short lines, one concrete question ("היום אחר הצהריים או מחר
בבוקר?" rather than "מתי נוח?"), everyday words ("סגור", "בא לך", "יש מצב"), commas instead of typographic dashes, sentences
instead of bullet lists; no slashes, no
gendered present-tense or imperatives; no childish emoji. A test fails if singular wording comes back
("ראיתי", "אשמח", "לך", "השארת"… or "I" in English), if 👋 🙂 🙌 🎉 🙏 🔥, "–" or "•", bot
phrases ("נשמח לעמוד לרשות", "פנייתך", "צוות אפיק הנחל", "We would be glad", "Dear "…), a team signature block or a Hebrew text
over 160 characters (or more than 3 lines) come back — the library was cut down to short messages on 2026-10-23 (median ~80 characters). **English messages** (rewritten 2026-10-24 in natural, professional English — "thanks for leaving your details", "Would you
like us to send…", "Tabu registration", "the Sharon region") **never carry a Hebrew word**: `lib/english-values.js` (tested — a test
renders all 61 templates in English for a Hebrew lead and fails on any Hebrew letter) writes the project in English
(`englishProject`: "זרובבל 15 - v2" → "15 Zerubavel Street", from a street / town list — add a new project's street there), the
form answers (`englishValue`: "5 מיליון ומעלה" → "₪5 million+", "3 חדרים" → "3 rooms", "פנטהאוז" → "a penthouse", towns), and
the name (the one typed in the form, else the Hebrew first name in English — `latinFirstName()` — else "Hi there"); a value it
can't write in English is left out (its `[[ … ]]` part drops). **Names:** a Hebrew message writes an English first name in Hebrew
(`lib/hebrew-names.js` `hebrewFirstName`, a list of ~450 Israeli names; "Ronen" → "רונן"); an unknown Latin name is left out
("שלום,") rather than guessed. `renderTemplate` closes the gap an empty placeholder leaves ("שלום ," → "שלום,"). The Lead Center's
quick replies use the same rules and the campaign's short name.
**Files in every chat, like WhatsApp** (2026-10-24): the chats tab (`ChatComposer` / `GreenAPIChat`), the Lead Center and the
lead card (`LeadConversation`) take photos, videos, PDF, Word / Excel and more — several at once (up to 10, 50 MB each), from
the paperclip ("צירוף"), dragged onto the conversation ("שחררו כאן") or pasted into the box. `src/ChatAttachments.jsx`
(`useAttachments`, `AttachTray` — thumbnails / file icons, size, ✕, per-file status —, `useFileDrop`, `DropOverlay`,
`pasteFiles`) + `src/lib/chatFiles.js` (tested: `acceptFiles`, `fileProblem`, `sendFiles`): every file is uploaded by the
browser straight to Supabase Storage (`wizard-upload-url`, `folder: 'chat'`, kinds image / video / pdf / doc → `property-media/
chat/<month>/…`; photos compressed to ≤ 1600 px JPEG first) — never through a Vercel function, so no 3 MB cap — and sent by URL:
`chat-send` / `messages` take `{ file, fileName }` → `sendText(…, { file, fileName })` → Green's `sendFileByUrl` with the original
name (`mediaFileName()`); the text is the first file's caption, then the rest; a failure keeps the unsent files in the tray. In
the Lead Center the very first message (the welcome) goes as text first, then the files.
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
**Sending in the chat** (messaging UI v2, 2026-10-23 — line icons from `src/uiIcons.jsx` (`Icon`, `CatTile` per template
category), never emoji in the UI chrome): **the message box** is `src/ChatComposer.jsx` (GreenAPIChat keeps the state) — one card
with the "מתבנית · <title>" line (changed → "שמירה בתבנית", ✕ clears the box), the attachment or the template's picture, the
text (grows; Enter sends, Shift+Enter = new line; the placeholder names the lead) and a toolbar: emoji · attach · "תבניות" … a
labelled green "שלח" / "שלח עם תמונה" (icon-only on phones). **"הצעות"** over the empty box (`ChatQuickChips` in
`src/ChatTemplatePicker.jsx`: the 3–4 templates that fit this lead now — the most personal one + the stage's category): a click
puts one in the box, the round button sends it. **The templates window** (`ChatTemplatePicker`): categories (a side column when
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
**WhatsApp page → ⚡ "תבניות מוכנות"** (`src/ChatTemplatePicker.jsx`): the whole library (61 templates, incl. chat-ready ones —
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

Scheduled bulk sends are jobs in `app_settings` (`automations_jobs`), rendered at send time, max 20 messages per run;
`auto-jobs-tick` pushes a running job from the open panel. `auto-tick?key=` (key = `AUTOMATION_KEY`, or the admin token)
lets an external pinger such as cron-job.org run the engine every 5 minutes, so timing is exact even with the panel closed.
Sending hours are `[start, end)` per weekday in 0.5-hour steps (Israel time); welcome, replies and stage messages ignore them.

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
Every field saves on its own through `updateLead` → `PATCH /api/contacts` (merged into `crm_data`). **The whole conversation sits in the card:** on a screen ≥ 1100 px the card widens (1640 px) and shows the lead's WhatsApp
chat as a third column — the Lead Center's `LeadConversation` (history, templates, sending through `/api/meta/chat-send`, the
automations config read once per session); "הסתר שיחה" hides it (`localStorage.afik_lead_card_conv`). Narrower screens get it
inside the "שיחת וואטסאפ" tab under the AI summary (`LeadChatTab hideConversation`).
**Stages** (`GROUPS` in `src/LeadsBoard.jsx`, `STAGES` in `lib/automations-shared.js` / `src/AdminHome.jsx`): new · contacted ·
discovery · **meeting** ("נקבעה פגישה", between discovery and negotiating; its stage message defaults to `meeting_confirm`, off) · negotiating · won · lost · **nurture** ("לחזור בעוד כמה חודשים": moving a lead there sets a follow-up 3 months
out unless a future one exists — `updateLeadStatus`; its automation rule defaults to off) · **irrelevant** ("לא רלוונטי": its board column starts collapsed — a narrow drop strip,
every column can be collapsed and the choice is kept in `localStorage.afik_kanban_collapsed`; bulk sends leave these leads out
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
merge (2 selected) and delete (asks once, leads go to the trash). **Merge** (`src/lib/leadMerge.js`, tested — `mergeLeads()` /
`mergeConflicts()`): from two selected rows or by holding a dragged Pipeline card on another card for 0.65 s ("שחרר כדי למזג");
`MergeDialog` picks the lead that stays and the values for conflicting name / phone / email; notes, tasks, tags, form answers,
stage history, the other message and `mergedFrom` are kept, then the other lead goes to the trash (nothing is deleted if the save
fails). Pipeline cards no longer shift while dragging (`NO_SHIFT` — the order in a column isn't saved). Meta form option codes read
as words (`prettyAnswerValue` / `prettyLeadText`: "3r" → "3 חדרים", "b34" → "3–4 מיליון").

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
