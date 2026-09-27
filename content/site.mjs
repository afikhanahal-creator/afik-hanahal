// Single source of truth for entity facts used by every generated page (schema, footer, trust layer).
// Every value here is taken from what the site already states (index.html, App.jsx, PrivacyModal). Nothing invented.
export const SITE = {
  origin: 'https://afikhanahal.co.il',
  brand: { he: 'אפיק הנחל', en: 'Afik Hanahal' },
  legalName: 'אפיק הנחל יזום שיווק תיווך נדלן בע"מ',
  legalNameEn: 'Afik Hanahal Development Marketing & Brokerage Ltd.',
  tagline: { he: 'ייזום · שיווק · תיווך · קרקעות', en: 'Development · Marketing · Brokerage · Land' },
  regNumber: '517082038',
  founder: { he: 'ישראל בן יהודה', en: 'Israel Ben-Yehuda', role: { he: 'מייסד ומנכ"ל', en: 'Founder & CEO' } },
  phone: '055-981-1814', phoneIntl: '+972559811814', whatsapp: 'https://wa.me/972559811814',
  email: 'afik.hanahal@gmail.com',
  address: { street: 'הנגר 24', extra: 'מגדלי Amy, מגדל A', city: { he: 'הוד השרון', en: 'Hod Hasharon' }, region: { he: 'השרון', en: 'Sharon' }, country: 'IL',
             streetEn: '24 HaNagar St., Amy Towers, Tower A' },
  hours: { he: 'ראשון–חמישי 09:00–19:00 · שישי 09:00–14:00', en: 'Sun–Thu 09:00–19:00 · Fri 09:00–14:00' },
  social: { instagram: 'https://www.instagram.com/afik.hanahal/', facebook: 'https://www.facebook.com/profile.php?id=61573376818745' },
  logo: '/img/icon-512.png',
  ogImage: '/img/og-default.png',
  // Where the company actually works (site copy: "השרון והמרכז", active nationwide)
  areaServed: { he: ['השרון', 'המרכז', 'ישראל'], en: ['Sharon region', 'Central Israel', 'Israel'] },
  gaId: 'G-X1S3XX7TRV',
  metaPixels: ['1341264237748951', '1311196023271539'],
  experienceYears: 30,   // site copy: "קרוב ל-30 שנות ניסיון" / "מעל 30 שנה"
}

// Chrome strings — every UI string in both languages (project rule)
export const UI = {
  he: {
    nav: { home: 'ראשי', services: 'שירותים', areas: 'אזורי פעילות', guides: 'מדריכים', glossary: 'מילון מונחים', tools: 'כלים', faq: 'שאלות נפוצות', company: 'על החברה', properties: 'נכסים', contact: 'צרו קשר' },
    skip: 'דלג לתוכן', updated: 'עודכן לאחרונה', readMore: 'קראו עוד', inShort: 'בקצרה', faq: 'שאלות נפוצות', related: 'קשור', relatedServices: 'שירותים קשורים',
    relatedAreas: 'אזורים', relatedGuides: 'מדריכים קשורים', relatedTerms: 'מונחים קשורים', breadcrumbHome: 'ראשי', terms: 'מונחים', allGuides: 'כל המדריכים',
    trustTitle: 'למה אפיק הנחל', trustPoints: [
      'ניסיון של כ-30 שנה בשוק הנדל"ן והקרקעות בישראל',
      'התמחות בקרקעות פרטיות, מגרשים ופרויקטים חדשים בשרון ובמרכז',
      'ליווי מלא: מאיתור ובדיקת זכויות ועד רישום בטאבו',
      'ייצוג בעלי קרקע מול רוכשים, קבוצות רכישה וחברות בנייה',
    ],
    ctaCall: 'התקשרו', ctaWa: 'וואטסאפ', ctaEmail: 'מייל', form: {
      step1: 'מה מעניין אתכם?', step2: 'כמה פרטים על הנכס', step3: 'איך נחזור אליכם?', next: 'המשך', back: 'חזרה', send: 'שלחו ונחזור אליכם',
      name: 'שם מלא', phone: 'טלפון', email: 'אימייל (לא חובה)', city: 'עיר / אזור', type: 'סוג הנכס', size: 'שטח (מ"ר / דונם)', when: 'מתי?', notes: 'משהו שכדאי שנדע?',
      sending: 'שולח…', done: 'קיבלנו! נחזור אליכם בהקדם.', doneSub: 'אפשר גם להתקשר עכשיו:', error: 'משהו השתבש. אפשר להתקשר או לשלוח וואטסאפ.',
      privacy: 'הפרטים נשמרים אצלנו בלבד ומשמשים לחזרה אליכם.',
      intents: { sell: 'למכור נכס', rent: 'להשכיר נכס', land: 'יש לי קרקע', buy: 'לקנות / להשקיע', project: 'יש לי פרויקט', consult: 'ייעוץ / שאלה' },
      types: ['דירה', 'בית פרטי / צמוד קרקע', 'מגרש', 'קרקע חקלאית', 'נכס מסחרי', 'אחר'],
      whens: ['בהקדם', 'בחודשים הקרובים', 'בודקים אפשרויות'],
    },
    footer: { rights: 'כל הזכויות שמורות', company: 'ח.פ.', privacy: 'מדיניות פרטיות', accessibility: 'הצהרת נגישות', address: 'כתובת', hours: 'שעות פעילות' },
    disclaimer: 'המידע באתר הוא כללי ואינו מהווה ייעוץ משפטי, מיסויי או תכנוני. לפני כל עסקה יש להיוועץ באנשי מקצוע מוסמכים.',
    hubs: {
      services: { title: 'השירותים שלנו', desc: 'ייזום, שיווק ותיווך של קרקעות, מגרשים ונכסים — מה אנחנו עושים, למי זה מתאים ואיך עובדים איתנו.' },
      areas: { title: 'אזורי פעילות', desc: 'הוד השרון, כפר סבא, רעננה, הרצליה והשרון כולו — ידע מקומי על שוק הקרקעות והנכסים.' },
      guides: { title: 'מדריכים ומאמרים', desc: 'מדריכים מעשיים על יזמות נדל"ן, קרקעות, שינוי ייעוד, מכירת נכס ופיקוח על פרויקטים.' },
      glossary: { title: 'מילון מונחי נדל"ן', desc: 'הסברים פשוטים ומקצועיים למונחים שפוגשים בכל עסקת נדל"ן וקרקע בישראל.' },
      faq: { title: 'שאלות ותשובות על נדל"ן וקרקעות', desc: 'תשובות ישירות לשאלות שאנשים באמת שואלים — על יזמות, קרקעות, מכירה, השכרה ופיקוח.' },
      tools: { title: 'כלים ומחשבונים', desc: 'מחשבונים ומדריכים אינטראקטיביים לרוכשים, למוכרים ולמשקיעים.' },
    },
  },
  en: {
    nav: { home: 'Home', services: 'Services', areas: 'Areas', guides: 'Guides', glossary: 'Glossary', tools: 'Tools', faq: 'FAQ', company: 'About', properties: 'Properties', contact: 'Contact' },
    skip: 'Skip to content', updated: 'Last updated', readMore: 'Read more', inShort: 'In short', faq: 'Frequently asked questions', related: 'Related', relatedServices: 'Related services',
    relatedAreas: 'Areas', relatedGuides: 'Related guides', relatedTerms: 'Related terms', breadcrumbHome: 'Home', terms: 'Terms', allGuides: 'All guides',
    trustTitle: 'Why Afik Hanahal', trustPoints: [
      'About 30 years of experience in Israeli real estate and land',
      'Specialists in private land, plots and new projects in the Sharon and Central Israel',
      'End-to-end support: from sourcing and rights checks to Tabu registration',
      'Representing landowners opposite buyers, purchase groups and construction companies',
    ],
    ctaCall: 'Call', ctaWa: 'WhatsApp', ctaEmail: 'Email', form: {
      step1: 'What are you looking for?', step2: 'A few details about the property', step3: 'How should we reach you?', next: 'Continue', back: 'Back', send: 'Send — we will get back to you',
      name: 'Full name', phone: 'Phone', email: 'Email (optional)', city: 'City / area', type: 'Property type', size: 'Size (sqm / dunam)', when: 'When?', notes: 'Anything we should know?',
      sending: 'Sending…', done: 'Got it! We will be in touch shortly.', doneSub: 'You can also call now:', error: 'Something went wrong. Please call or WhatsApp us.',
      privacy: 'Your details stay with us and are used only to get back to you.',
      intents: { sell: 'Sell a property', rent: 'Rent out a property', land: 'I own land', buy: 'Buy / invest', project: 'I have a project', consult: 'Advice / question' },
      types: ['Apartment', 'House / detached', 'Plot', 'Agricultural land', 'Commercial', 'Other'],
      whens: ['As soon as possible', 'In the coming months', 'Exploring options'],
    },
    footer: { rights: 'All rights reserved', company: 'Reg. no.', privacy: 'Privacy policy', accessibility: 'Accessibility statement', address: 'Address', hours: 'Hours' },
    disclaimer: 'The information on this site is general and does not constitute legal, tax or planning advice. Consult licensed professionals before any transaction.',
    hubs: {
      services: { title: 'Our services', desc: 'Development, marketing and brokerage of land, plots and properties — what we do, who it is for and how we work.' },
      areas: { title: 'Where we work', desc: 'Hod Hasharon, Kfar Saba, Ra\'anana, Herzliya and the Sharon region — local knowledge of the land and property market.' },
      guides: { title: 'Guides & articles', desc: 'Practical guides on real estate development, land, rezoning, selling a property and construction supervision.' },
      glossary: { title: 'Real estate glossary', desc: 'Plain and professional explanations of the terms you meet in every Israeli real estate and land deal.' },
      faq: { title: 'Real estate & land Q&A', desc: 'Direct answers to the questions people actually ask — development, land, selling, renting and supervision.' },
      tools: { title: 'Tools & calculators', desc: 'Calculators and interactive guides for buyers, sellers and investors.' },
    },
  },
}

// Intent → CTA copy (dynamic CTA per page)
export const CTA = {
  sell:    { he: { h: 'רוצים למכור נכס בשרון?', p: 'ספרו לנו על הנכס ונחזור אליכם עם הערכה ראשונית ותוכנית שיווק — בלי התחייבות.', b: 'רוצה למכור נכס' },
             en: { h: 'Selling a property in the Sharon?', p: 'Tell us about the property and we will come back with an initial assessment and a marketing plan — no commitment.', b: 'I want to sell' } },
  rent:    { he: { h: 'רוצים להשכיר נכס?', p: 'נשמח לעזור למצוא שוכר מתאים ולסגור מהר. השאירו פרטים ונחזור אליכם.', b: 'רוצה להשכיר נכס' },
             en: { h: 'Renting out a property?', p: 'We will help you find the right tenant and close quickly. Leave your details and we will call back.', b: 'I want to rent out' } },
  land:    { he: { h: 'יש לכם קרקע? בואו נבדוק מה אפשר לעשות איתה', p: 'בדיקת ייעוד, זכויות ופוטנציאל השבחה — לפני שמחליטים למכור, לשווק או לקדם תוכנית.', b: 'רוצה לבדוק את הקרקע' },
             en: { h: 'Own land? Let us check what it can become', p: 'Zoning, rights and improvement potential — before you decide to sell, market or promote a plan.', b: 'Check my land' } },
  buy:     { he: { h: 'מחפשים קרקע או נכס להשקעה?', p: 'חלק מהנכסים שלנו אינם מתפרסמים בפורטלים. ספרו לנו מה אתם מחפשים ונחזור אליכם.', b: 'רוצה לשמוע על הזדמנויות' },
             en: { h: 'Looking for land or an investment property?', p: 'Some of our listings never reach the public portals. Tell us what you are after and we will be in touch.', b: 'Show me opportunities' } },
  project: { he: { h: 'מתכננים פרויקט? נשמח לדבר', p: 'ליווי מקידום התוכנית ושינוי הייעוד ועד העלייה לקרקע ושיווק הפרויקט.', b: 'רוצה לדבר על הפרויקט' },
             en: { h: 'Planning a project? Let us talk', p: 'Support from plan promotion and rezoning to breaking ground and marketing the project.', b: 'Discuss my project' } },
  consult: { he: { h: 'יש שאלה? דברו איתנו', p: 'שיחת ייעוץ ראשונה ללא עלות וללא התחייבות.', b: 'רוצה ייעוץ' },
             en: { h: 'Have a question? Talk to us', p: 'A first consultation, free and with no commitment.', b: 'Get advice' } },
}
