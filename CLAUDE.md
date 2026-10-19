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
arriving is visible. `.github/workflows/lead-tick.yml` calls `auto-tick` every 5 minutes (the repo is public: the log prints
counts only), so a lead is welcomed even with the panel closed and the webhook down.
**Lead Center** (`src/MetaLeadsTab.jsx`, admin "מרכז לידים"): connection dots (Meta / WhatsApp / welcome rule), KPIs, a list
grouped by day with a "קיבל הודעה / טרם נשלחה הודעה" chip per lead (Meta's testing-tool leads hidden by default), an overview
(needs attention, leads by campaign, connection health) and a lead page (call / WhatsApp / CRM, status, welcome card with
"שלח הודעת פתיחה עכשיו" = `POST /api/meta/lead-welcome {id}` → `welcomeExternalLead(…, { force: true })`, logged `by: 'manual'`,
details, form answers, notes, conversation). Messages typed there go out from the office WhatsApp (Green API) like the welcome.
**Every Meta lead is also in the CRM** (`lib/meta-crm.js`, tested): the webhook and every sync copy a new lead into `contacts`
(source `meta`, `crm_data.metaLeadId`, form answers in `message` / `crm_data.formAnswers`, phone as 05X…), so it shows in "לידים" and
in the bulk-send audience. The welcome stays with the Meta pipeline (`crm_data.auto` marks it sent / skipped, the CRM never sends a
second one); a lead saved late (or backfilled) is also marked past the no-reply follow-ups. Test leads, archived leads and leads
without phone or email are not copied. `POST /api/meta/crm-sync` (admin; daily cron; probe action `crm-sync`) copies whatever is
missing; the Lead Center's CRM button calls `POST /api/meta/lead-to-crm {id}`. The admin drops its old browser-only `meta_<id>` copies.

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
(lead + campaign + local phone + reason · the full message · send / skip / chat), then the schedule. **Wording per message:** a
template dropdown above every message (the item's category first, the whole library below — rendered for that lead in the
browser with `renderTemplate`), "נוסח אחר" (next template of the same category), "ערוך הודעה" (free edit), "שחזר נוסח"; the
group header has "נוסח לכל הקבוצה…". The send carries the chosen `templateId`. The built-in library has 61 bilingual templates
(welcome / late-welcome / investor / scheduling variants, follow-ups, visits, after-call, nurture, re-engagement, chat-ready
replies, deal steps), **written by people, from the Afik Hanahal page**: always plural — the office is "we" ("ראינו",
"נשמח", "נתקשר") and the lead is addressed in plural ("השארתם", "לכם", "אתכם"), which also keeps the Hebrew gender-neutral; the
first message introduces the office ("היי {name}, כאן אפיק הנחל."), later ones carry no signature (`{agent}`, default
"צוות אפיק הנחל", only signs the closing / holiday messages, inside `[[ … ]]` so an empty value drops the line); "היי" (or `{greeting}`: `timeGreeting()` = בוקר טוב / צהריים טובים / ערב טוב by the Israel hour, rendered at send
time) instead of "שלום … תודה על פנייתך"; the welcome says what a person would know — `{when}` (`leadWhen()`: היום / אתמול /
ביום שלישי, '' after a week) and `{where}` (`leadWhere()`: במודעה for Meta leads, באתר for website forms) — "ראיתי שהשארת פרטים
אתמול במודעה על זרובבל 15. אפשר להתקשר אליך לכמה דקות?"; 1–3 short lines, one concrete question ("היום אחר הצהריים או מחר
בבוקר?" rather than "מתי נוח?"), everyday words ("סגור", "בא לך", "יש מצב"), commas instead of typographic dashes, sentences
instead of bullet lists; no slashes, no
gendered present-tense or imperatives; no childish emoji. A test fails if singular wording comes back
("ראיתי", "אשמח", "לך", "השארת"… or "I" in English), if 👋 🙂 🙌 🎉 🙏 🔥, "–" or "•", bot
phrases ("נשמח לעמוד לרשות", "פנייתך", "צוות אפיק הנחל", "We would be glad", "Dear "…), a team signature block or a Hebrew text
over 420 characters come back. **Names:** a Hebrew message writes an English first name in Hebrew
(`lib/hebrew-names.js` `hebrewFirstName`, a list of ~450 Israeli names; "Ronen" → "רונן"); an unknown Latin name is left out
("שלום,") rather than guessed. `renderTemplate` closes the gap an empty placeholder leaves ("שלום ," → "שלום,"). The Lead Center's
quick replies use the same rules and the campaign's short name.
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
| API `/api/meta/booking-*`: public `config` · `slots` (edge 20 s) · `create` · `oauth-callback`; admin `admin` · `settings` · `connect` · `disconnect` · `cancel` | `api/meta.js` → `handleBooking` |
| Public page (own chunk) | `src/BookingPage.jsx` (route in `src/main.jsx`) |
| Admin tab "תיאום פגישות" (`/admin-panel/bookings`): link, calendar connection, hours & rules, Zoom link, upcoming / past meetings, cancel | `src/BookingAdminTab.jsx` |

A booking: re-checks the slot against a fresh calendar read (never double-books; every booking is also in
`app_settings.booking_log`, so it works before the calendar is connected — then the office adds it by hand), creates the
event (Meet link + invitation to the client's email), creates / updates the lead in `contacts` (source `booking`, stage
discovery, `crm_data.booking` / `bookings`, a 📅 note, `followUp` = the meeting; the automatic welcome is skipped — the
confirmation is the first message), alerts the office (WhatsApp `notifyTeam` + email) and sends the client a WhatsApp
confirmation (plural "we" voice). Limits: 2 upcoming bookings per phone, 6 attempts per IP in 10 minutes, a honeypot field.
Templates: `{bookingLink}` (`vars.bookingLink`, `?lang=en` added for English) in `welcome_book` and `book_link`.
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
**Stages** (`GROUPS` in `src/LeadsBoard.jsx`, `STAGES` in `lib/automations-shared.js` / `src/AdminHome.jsx`): new · contacted ·
discovery · negotiating · won · lost · **nurture** ("לחזור בעוד כמה חודשים": moving a lead there sets a follow-up 3 months
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
Pipeline, Table. **Table selection:** the checkbox column is pinned with `insetInlineStart` (RTL-safe — a `left: 0` pin used to
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
