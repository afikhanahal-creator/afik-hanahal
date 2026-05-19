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
