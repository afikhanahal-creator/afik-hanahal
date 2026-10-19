// The content editor's form: which fields each homepage area has, in page order, with Hebrew / English labels.
// Paths follow content/home.json (area id = its top-level key); lengths and list sizes come from lib/home-content.js.
// Field types: text ({ he, en }), textlist ([{ he, en }]), list ([{ …fields }]), plain (a string), image (a path / URL),
// bool, icon (HOME_ICONS), accent ('purple' | 'green').

const t = (key, he, en, opts = {}) => ({ key, type: 'text', he, en, ...opts })
const p = (key, he, en, opts = {}) => ({ key, type: 'plain', he, en, ...opts })

export const CONTENT_AREAS = [
  { id: 'hero', anchor: 'home', he: 'פתיחה (ראש הדף)', en: 'Hero (top of the page)', fields: [
    t('badge', 'תגית מעל הכותרת', 'Badge above the headline'),
    t('line1', 'כותרת, שורה 1', 'Headline, line 1'),
    t('line2', 'כותרת, שורה 2 (בצבע)', 'Headline, line 2 (colored)'),
    { key: 'typewriter', type: 'textlist', he: 'משפטים מתחלפים (מוקלדים)', en: 'Rotating typed lines', item: { he: 'משפט', en: 'Line' } },
    t('desc', 'תיאור', 'Description', { multi: true }),
    t('cta1', 'כפתור ראשי', 'Main button'),
    t('cta2', 'כפתור שני', 'Second button'),
    t('cta3', 'כפתור שלישי', 'Third button'),
    { key: 'tags', type: 'textlist', he: 'תגיות סוגי נכסים', en: 'Property-type tags', item: { he: 'תגית', en: 'Tag' } },
  ] },
  { id: 'ceo', anchor: 'ceo', he: 'המנכ״ל', en: 'CEO', fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('quotePre', 'ציטוט פתיחה: לפני ההדגשה', 'Opening quote: before the highlight', { multi: true }),
    t('quoteHighlight', 'ציטוט פתיחה: החלק המודגש', 'Opening quote: highlighted part'),
    t('quotePost', 'ציטוט פתיחה: אחרי ההדגשה', 'Opening quote: after the highlight', { multi: true }),
    { key: 'paragraphs', type: 'textlist', multi: true, he: 'פסקאות', en: 'Paragraphs', item: { he: 'פסקה', en: 'Paragraph' } },
    t('name', 'שם', 'Name'),
    t('role', 'תפקיד', 'Role'),
    { key: 'photo', type: 'image', he: 'תמונה', en: 'Photo' },
  ] },
  { id: 'story', anchor: 'story', he: 'הסיפור שלנו', en: 'Our story', fields: [
    t('badge', 'תגית', 'Badge'),
    t('line1', 'כותרת, שורה 1', 'Title, line 1'),
    t('line2', 'כותרת, שורה 2', 'Title, line 2'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'paragraphs', type: 'textlist', multi: true, he: 'פסקאות', en: 'Paragraphs', item: { he: 'פסקה', en: 'Paragraph' } },
    t('blockquote', 'משפט מודגש', 'Highlighted sentence', { multi: true }),
    t('cta', 'כפתור', 'Button'),
    { key: 'features', type: 'list', he: 'יתרונות', en: 'Advantages', item: { he: 'יתרון', en: 'Advantage' }, title: 'title', fields: [
      t('title', 'כותרת', 'Title'), t('desc', 'תיאור', 'Description', { multi: true }),
    ] },
    t('sharonTitle', 'כותרת "בלעדי בשרון"', '"Sharon exclusive" title'),
    t('nationwideTitle', 'כותרת "פעילות ארצית"', '"Nationwide" title'),
    t('nationwideDesc', 'תיאור "פעילות ארצית"', '"Nationwide" description', { multi: true }),
  ] },
  { id: 'process', anchor: 'process', he: 'התהליך', en: 'Process', fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'steps', type: 'list', he: 'שלבים (המספור אוטומטי)', en: 'Steps (numbered automatically)', item: { he: 'שלב', en: 'Step' }, title: 'title', fields: [
      { key: 'icon', type: 'icon', he: 'אייקון', en: 'Icon' }, { key: 'accent', type: 'accent', he: 'צבע', en: 'Color' },
      t('title', 'כותרת', 'Title'), t('desc', 'תיאור', 'Description', { multi: true }),
    ] },
    t('readyTitle', 'כותרת "מוכנים להתחיל"', '"Ready to start" title'),
    t('readyDesc', 'תיאור "מוכנים להתחיל"', '"Ready to start" description', { multi: true }),
  ] },
  { id: 'services', anchor: 'services', he: 'השירותים', en: 'Services', fields: [
    t('badge', 'תגית', 'Badge'),
    t('line1', 'כותרת, שורה 1', 'Title, line 1'),
    t('line2', 'כותרת, שורה 2', 'Title, line 2'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'items', type: 'list', he: 'שירותים', en: 'Services', item: { he: 'שירות', en: 'Service' }, title: 'title', fields: [
      { key: 'icon', type: 'icon', he: 'אייקון', en: 'Icon' }, { key: 'accent', type: 'accent', he: 'צבע', en: 'Color' },
      t('title', 'כותרת', 'Title'), t('desc', 'תיאור', 'Description', { multi: true }),
    ] },
  ] },
  { id: 'properties', anchor: 'properties', he: 'כותרת הנכסים', en: 'Properties header', note: { he: 'הנכסים עצמם מנוהלים ב"ניהול נכסים".', en: 'The properties themselves are managed in "Properties".' }, fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
  ] },
  { id: 'testimonials', anchor: 'testimonials', he: 'המלצות', en: 'Testimonials', fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'items', type: 'list', he: 'המלצות', en: 'Testimonials', item: { he: 'המלצה', en: 'Testimonial' }, title: 'name',
      extra: { imgFit: 'cover', imgPos: 'center top' }, fields: [
        t('quote', 'ההמלצה', 'Quote', { multi: true }),
        t('name', 'שם', 'Name'),
        t('designation', 'תפקיד (לא חובה)', 'Role (optional)', { optional: true }),
        t('firm', 'חברה (לא חובה)', 'Company (optional)', { optional: true }),
        { key: 'photo', type: 'image', he: 'תמונה', en: 'Photo' },
      ] },
  ] },
  { id: 'faq', anchor: 'faq', he: 'שאלות נפוצות', en: 'FAQ', fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'items', type: 'list', he: 'שאלות ותשובות', en: 'Questions & answers', item: { he: 'שאלה', en: 'Question' }, title: 'q', fields: [
      t('q', 'שאלה', 'Question', { multi: true }), t('a', 'תשובה', 'Answer', { multi: true }),
    ] },
  ] },
  { id: 'about', anchor: 'about', he: 'אודות', en: 'About', fields: [
    t('badge', 'תגית', 'Badge'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    { key: 'points', type: 'textlist', he: 'נקודות', en: 'Points', item: { he: 'נקודה', en: 'Point' } },
    t('cta', 'כפתור', 'Button'),
  ] },
  { id: 'playlist', anchor: 'playlist', he: 'פלייליסט', en: 'Playlist', fields: [
    { key: 'visible', type: 'bool', he: 'להציג את האזור באתר', en: 'Show this section on the site' },
    t('label', 'תגית', 'Label'),
    t('title', 'כותרת', 'Title'),
    t('desc', 'תיאור', 'Description', { multi: true }),
    p('url', 'קישור הטמעה של ספוטיפיי (open.spotify.com/embed/…)', 'Spotify embed link (open.spotify.com/embed/…)', { ltr: true }),
  ] },
  { id: 'booking', anchor: 'contact', he: 'קביעת פגישות (קישורים באתר)', en: 'Booking (links on the site)', note: { he: 'הקישורים לעמוד קביעת השיחה (/book) בראש הדף, בטופס יצירת הקשר, בחלון הנכס ובפוטר. את סוגי הפגישות והשעות משנים ב"תיאום פגישות".', en: 'The links to the booking page (/book) in the hero, the contact form, the property window and the footer. Meeting types and hours are set in "Bookings".' }, fields: [
    t('cta', 'כפתור', 'Button'),
    t('line', 'משפט בראש הדף ובטופס', 'Line in the hero and the form'),
    t('after', 'אחרי שליחת טופס', 'After a form is sent'),
  ] },
  { id: 'office', anchor: 'contact', he: 'פרטי המשרד (פוטר ויצירת קשר)', en: 'Office details (footer & contact)', note: { he: 'מופיעים בכל האתר, גם בעמודי התוכן.', en: 'Shown across the site, including the content pages.' }, fields: [
    p('phone', 'טלפון (כפי שמוצג)', 'Phone (as shown)', { ltr: true }),
    p('tel', 'טלפון לחיוג (ספרות בלבד)', 'Phone to dial (digits only)', { ltr: true }),
    p('whatsapp', 'וואטסאפ (972…)', 'WhatsApp (972…)', { ltr: true }),
    p('email', 'אימייל', 'Email', { ltr: true }),
    p('facebook', 'פייסבוק', 'Facebook', { ltr: true }),
    p('instagram', 'אינסטגרם', 'Instagram', { ltr: true }),
    { key: 'hours', type: 'list', he: 'שעות פעילות', en: 'Opening hours', item: { he: 'שורה', en: 'Row' }, title: 'days', fields: [
      t('days', 'ימים', 'Days'), p('time', 'שעות', 'Hours', { ltr: true }),
    ] },
    t('area', 'אזור שירות', 'Service area'),
  ] },
]

/** An empty item for a list field (every text pair blank, the first icon, purple) */
export function newItem(field) {
  if (field.type === 'textlist') return { he: '', en: '' }
  const o = {}
  for (const f of field.fields) {
    o[f.key] = f.type === 'text' ? { he: '', en: '' } : f.type === 'icon' ? 'FaSearch' : f.type === 'accent' ? 'purple' : ''
  }
  return { ...o, ...(field.extra || {}) }
}
