// The homepage content (content/home.json): its rules and the shape the site's components read.
// Pure — shared by the site (App.jsx, at build time), the static first screen (lib/home-page.js), the content pages
// (content/site.mjs), the build (scripts/build-content.mjs fails on invalid content) and the admin's content editor.
//
// A text is always a pair { he, en } (the site is bilingual — CLAUDE.md); lists are arrays of objects of pairs.

// Icons an item may use (react-icons/fa names already bundled with the site)
export const HOME_ICONS = ['FaSearch', 'FaBalanceScale', 'FaMoneyBill', 'FaHandshake', 'FaFileAlt', 'FaTrophy', 'FaChartLine', 'FaEye', 'FaHardHat', 'FaKey']
export const HOME_ACCENTS = ['purple', 'green']

// Length limits keep the layout intact (a hero line wraps badly past ~32 characters on a phone)
const S = { badge: 60, line: 40, title: 90, short: 120, desc: 260, para: 900, quote: 700 }

// path → max length (Hebrew; English may be 30% longer) for every single text; lists below
const TEXTS = {
  'hero.badge': S.badge, 'hero.line1': S.line, 'hero.line2': S.line, 'hero.desc': S.desc,
  'hero.cta1': 30, 'hero.cta2': 30, 'hero.cta3': 30,
  'ceo.badge': S.badge, 'ceo.title': S.title, 'ceo.quotePre': S.desc, 'ceo.quoteHighlight': 40, 'ceo.quotePost': S.desc,
  'ceo.name': 60, 'ceo.role': 80,
  'story.badge': S.badge, 'story.line1': S.line, 'story.line2': S.line, 'story.desc': S.desc, 'story.blockquote': S.desc,
  'story.cta': 30, 'story.sharonTitle': S.badge, 'story.nationwideTitle': S.badge, 'story.nationwideDesc': S.desc,
  'process.badge': S.badge, 'process.title': S.title, 'process.desc': S.desc, 'process.readyTitle': S.badge, 'process.readyDesc': S.short,
  'services.badge': S.badge, 'services.line1': S.line, 'services.line2': S.line, 'services.desc': S.desc,
  'properties.badge': S.badge, 'properties.title': S.title, 'properties.desc': S.desc,
  'testimonials.badge': S.badge, 'testimonials.title': S.title, 'testimonials.desc': S.desc,
  'faq.badge': S.badge, 'faq.title': S.title, 'faq.desc': S.desc,
  'about.badge': S.badge, 'about.title': S.title, 'about.desc': S.para, 'about.cta': 30,
  'playlist.label': S.badge, 'playlist.title': S.title, 'playlist.desc': S.desc,
  'office.area': S.short,
}
// list path → { min, max, fields: { field: maxLength | 'icon' | 'accent' | 'photo' | 'optional:<max>' }, text: maxLength for lists of plain pairs }
const LISTS = {
  'hero.typewriter': { min: 1, max: 8, text: 40 },
  'hero.tags': { min: 0, max: 10, text: 30 },
  'ceo.paragraphs': { min: 1, max: 8, text: S.para },
  'story.paragraphs': { min: 1, max: 8, text: S.para },
  'story.features': { min: 2, max: 8, fields: { title: 40, desc: S.short } },
  'process.steps': { min: 2, max: 12, fields: { icon: 'icon', accent: 'accent', title: 60, desc: S.desc } },
  'services.items': { min: 2, max: 12, fields: { icon: 'icon', accent: 'accent', title: 60, desc: S.para } },
  'testimonials.items': { min: 1, max: 20, fields: { quote: S.quote, name: 60, designation: 'optional:120', firm: 'optional:120', photo: 'photo' } },
  'faq.items': { min: 1, max: 40, fields: { q: 200, a: 1500 } },
  'about.points': { min: 1, max: 10, text: S.short },
  'office.hours': { min: 1, max: 7, fields: { days: 30, time: 'plain:30' } },
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const isPair = v => v && typeof v === 'object' && typeof v.he === 'string' && typeof v.en === 'string'

function checkPair(errors, path, v, max, optional = false) {
  if (!isPair(v)) { if (!optional || v != null) errors.push({ path, code: 'missing', msg: 'חסר טקסט (עברית ואנגלית)' }); return }
  const he = v.he.trim(), en = v.en.trim()
  if (optional && !he && !en) return
  if (!he) errors.push({ path: `${path}.he`, code: 'empty', msg: 'חסר טקסט בעברית' })
  if (!en) errors.push({ path: `${path}.en`, code: 'empty', msg: 'חסר טקסט באנגלית' })
  if (max && he.length > max) errors.push({ path: `${path}.he`, code: 'long', msg: `ארוך מדי (${he.length}/${max})` })
  if (max && en.length > max * 1.3) errors.push({ path: `${path}.en`, code: 'long', msg: `ארוך מדי (${en.length}/${Math.round(max * 1.3)})` })
}

/** → [{ path, code, msg }] — empty when the content can be published */
export function validateHome(home) {
  const errors = []
  if (!home || typeof home !== 'object') return [{ path: '', code: 'missing', msg: 'אין תוכן' }]
  for (const [path, max] of Object.entries(TEXTS)) checkPair(errors, path, get(home, path), max)
  for (const [path, rule] of Object.entries(LISTS)) {
    const list = get(home, path)
    if (!Array.isArray(list)) { errors.push({ path, code: 'missing', msg: 'רשימה חסרה' }); continue }
    if (list.length < rule.min) errors.push({ path, code: 'few', msg: `צריך לפחות ${rule.min} פריטים` })
    if (list.length > rule.max) errors.push({ path, code: 'many', msg: `עד ${rule.max} פריטים` })
    list.forEach((item, i) => {
      const p = `${path}.${i}`
      if (rule.text) return checkPair(errors, p, item, rule.text)
      for (const [f, r] of Object.entries(rule.fields)) {
        const v = item?.[f], fp = `${p}.${f}`
        if (r === 'icon') { if (!HOME_ICONS.includes(v)) errors.push({ path: fp, code: 'icon', msg: 'אייקון לא מוכר' }) }
        else if (r === 'accent') { if (!HOME_ACCENTS.includes(v)) errors.push({ path: fp, code: 'accent', msg: 'צבע לא מוכר' }) }
        else if (r === 'photo') { if (v && !/^(\/|https:\/\/)\S+$/.test(v)) errors.push({ path: fp, code: 'url', msg: 'כתובת תמונה לא תקינה' }) }
        else if (typeof r === 'string' && r.startsWith('plain:')) { if (typeof v !== 'string' || !v.trim()) errors.push({ path: fp, code: 'empty', msg: 'שדה ריק' }) }
        else if (typeof r === 'string' && r.startsWith('optional:')) checkPair(errors, fp, v, Number(r.split(':')[1]), true)
        else checkPair(errors, fp, v, r)
      }
    })
  }
  const o = home.office || {}
  if (!/^0\d{1,2}-?\d{3}-?\d{4}$/.test(o.phone || '')) errors.push({ path: 'office.phone', code: 'phone', msg: 'מספר טלפון לא תקין' })
  if (!/^0\d{8,9}$/.test(o.tel || '')) errors.push({ path: 'office.tel', code: 'phone', msg: 'מספר טלפון לחיוג לא תקין (ספרות בלבד)' })
  if (!/^972\d{8,9}$/.test(o.whatsapp || '')) errors.push({ path: 'office.whatsapp', code: 'phone', msg: 'מספר וואטסאפ לא תקין (972…)' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email || '')) errors.push({ path: 'office.email', code: 'email', msg: 'אימייל לא תקין' })
  for (const k of ['facebook', 'instagram']) if (!/^https:\/\/\S+$/.test(o[k] || '')) errors.push({ path: `office.${k}`, code: 'url', msg: 'קישור לא תקין' })
  if (!/^\/\S+$|^https:\/\/\S+$/.test(home.ceo?.photo || '')) errors.push({ path: 'ceo.photo', code: 'url', msg: 'כתובת תמונה לא תקינה' })
  if (home.playlist?.visible && !/^https:\/\/open\.spotify\.com\/embed\/\S+$/.test(home.playlist?.url || '')) errors.push({ path: 'playlist.url', code: 'url', msg: 'קישור פלייליסט לא תקין (open.spotify.com/embed/…)' })
  return errors
}

const pick = (v, lang) => (v ? (lang === 'en' ? v.en : v.he) : '')

/** Office hours as lines: "ראשון–חמישי: 09:00–19:00" (the site's footer / contact panel) */
export const hoursLine = (h, lang) => `${pick(h.days, lang)}: ${h.time}`
/** All hours on one line: "ראשון–חמישי 09:00–19:00 · שישי 09:00–14:00" (the content pages) */
export const hoursText = (home, lang) => (home.office?.hours || []).map(h => `${pick(h.days, lang)} ${h.time}`).join(' · ')

/**
 * The content in the shapes the site's components already read: TR keys (per language), the data arrays with
 * he / en_ fields, the typewriter lines, the office details. The site renders exactly what it rendered before.
 */
export function homeLegacy(home) {
  const tr = lang => ({
    heroBadge: pick(home.hero.badge, lang), heroH1line1: pick(home.hero.line1, lang), heroH1line2: pick(home.hero.line2, lang),
    heroDesc: pick(home.hero.desc, lang), heroCTA1: pick(home.hero.cta1, lang), heroCTA2: pick(home.hero.cta2, lang), heroCTA3: pick(home.hero.cta3, lang),
    heroTags: home.hero.tags.map(t => pick(t, lang)),
    ceoBadge: pick(home.ceo.badge, lang), ceoH2: pick(home.ceo.title, lang),
    ceoOpeningQuotePre: pick(home.ceo.quotePre, lang), ceoOpeningQuoteHighlight: pick(home.ceo.quoteHighlight, lang), ceoOpeningQuotePost: pick(home.ceo.quotePost, lang),
    ceoParagraphs: home.ceo.paragraphs.map(t => pick(t, lang)), ceoName: pick(home.ceo.name, lang), ceoRole: pick(home.ceo.role, lang),
    storyBadge: pick(home.story.badge, lang), storyH1line1: pick(home.story.line1, lang), storyH1line2: pick(home.story.line2, lang),
    storyDesc: pick(home.story.desc, lang), storyParas: home.story.paragraphs.map(t => pick(t, lang)), storyBlockquote: pick(home.story.blockquote, lang),
    storyContactBtn: pick(home.story.cta, lang), sharonExclusive: pick(home.story.sharonTitle, lang),
    nationwideTitle: pick(home.story.nationwideTitle, lang), nationwideDesc: pick(home.story.nationwideDesc, lang),
    storyFeatures: home.story.features.map(f => ({ title: pick(f.title, lang), desc: pick(f.desc, lang) })),
    processBadge: pick(home.process.badge, lang), processH1: pick(home.process.title, lang), processDesc: pick(home.process.desc, lang),
    processReadyTitle: pick(home.process.readyTitle, lang), processReadyDesc: pick(home.process.readyDesc, lang),
    servicesBadge: pick(home.services.badge, lang), servicesH1line1: pick(home.services.line1, lang), servicesH1line2: pick(home.services.line2, lang),
    servicesDesc: pick(home.services.desc, lang),
    propertiesTitle: pick(home.properties.badge, lang), propertiesH2: pick(home.properties.title, lang), propertiesDesc: pick(home.properties.desc, lang),
    testimonialsBadge: pick(home.testimonials.badge, lang), testimonialsH2: pick(home.testimonials.title, lang), testimonialsDesc: pick(home.testimonials.desc, lang),
    faqBadge: pick(home.faq.badge, lang), faqH2: pick(home.faq.title, lang), faqDesc: pick(home.faq.desc, lang),
    aboutTitle: pick(home.about.badge, lang), aboutH2: pick(home.about.title, lang), aboutDesc: pick(home.about.desc, lang),
    aboutPoints: home.about.points.map(t => pick(t, lang)), contactNowBtn: pick(home.about.cta, lang),
    sunToThurs: home.office.hours[0] ? hoursLine(home.office.hours[0], lang) : '',
    friday: home.office.hours[1] ? hoursLine(home.office.hours[1], lang) : '',
    areaServed: pick(home.office.area, lang),
  })
  const item = s => ({ icon: s.icon, accent: s.accent, title: s.title.he, en_title: s.title.en, desc: s.desc.he, en_desc: s.desc.en })
  return {
    tr: { he: tr('he'), en: tr('en') },
    typewriter: { he: home.hero.typewriter.map(t => t.he), en: home.hero.typewriter.map(t => t.en) },
    process: home.process.steps.map((s, i) => ({ num: String(i + 1).padStart(2, '0'), ...item(s) })),
    services: home.services.items.map(item),
    testimonials: home.testimonials.items.map(t => ({
      quote: t.quote.he, en_quote: t.quote.en, name: t.name.he, en_name: t.name.en,
      designation: t.designation?.he || '', en_designation: t.designation?.en || '',
      ...(t.firm && (t.firm.he || t.firm.en) ? { firm: t.firm.he, en_firm: t.firm.en } : {}),
      src: t.photo || '', ...(t.imgFit ? { imgFit: t.imgFit } : {}), ...(t.imgPos ? { imgPos: t.imgPos } : {}),
    })),
    faqs: home.faq.items.map(f => ({ q: f.q.he, a: f.a.he, en_q: f.q.en, en_a: f.a.en })),
    office: home.office,
    ceoPhoto: home.ceo.photo,
    playlist: home.playlist,
  }
}
