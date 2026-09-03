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
