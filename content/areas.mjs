// Local pages — each with real local value (neighbourhood structure, planning context, what kind of land/property exists),
// no invented projects, no invented prices. Sharon-region is the regional pillar.
const U = '2026-09-16'
export const AREAS = [
  {
    slug: 'hod-hasharon', cta: 'land', updated: U, image: '/img/og-default.png',
    related: { services: ['land-brokerage', 'real-estate-development', 'sell-your-property'], areas: ['kfar-saba', 'raanana', 'sharon-region'], guides: ['land-due-diligence-checklist', 'rezoning-process'], glossary: ['taba', 'private-land', 'detached-house', 'urban-renewal'] },
    he: {
      h1: 'נדל"ן וקרקעות בהוד השרון — יזמות, שיווק ותיווך', cardTitle: 'הוד השרון', placeName: 'הוד השרון',
      metaTitle: 'נדל"ן בהוד השרון: קרקעות, מגרשים, יזמות ושיווק נכסים | אפיק הנחל',
      description: 'אפיק הנחל פועלת מהוד השרון: תיווך ושיווק קרקעות ומגרשים, יזמות וקידום תוכניות, ומכירת דירות ובתים בעיר. מה מאפיין את שוק הנדל"ן בהוד השרון ומה חשוב לבעלי קרקע ולרוכשים.',
      summary: 'הוד השרון היא עיר משפחתית בלב השרון, עם הרבה בנייה נמוכה וצמודי קרקע לצד שכונות חדשות של בנייה רוויה, ועם מלאי קרקע פרטית שעדיין עובר תהליכי תכנון. אפיק הנחל ממוקמת בעיר (הנגר 24) ופועלת בה יום-יום: תיווך ושיווק קרקעות ומגרשים, קידום תוכניות ושינויי ייעוד, ומכירת דירות ובתים.',
      sections: [
        { h2: 'מה מאפיין את הנדל"ן בהוד השרון', paras: [
          'הוד השרון נוצרה מאיחוד של מושבות ומושבים ותיקים — מגדיאל, רמתיים, הדר ורמת הדר — ולכן יש בה שילוב נדיר: שכונות ותיקות עם מגרשים גדולים וצמודי קרקע, לצד שכונות חדשות (כמו אזור 1200 במזרח העיר) עם בנייה רוויה ותשתיות חדשות. העיר גובלת בכפר סבא, ברעננה וברמת השרון, ונהנית מביקוש גבוה של משפחות.',
          'מבחינת קרקעות, הוד השרון מעניינת במיוחד: יש בה עדיין קרקעות פרטיות בשולי השטח הבנוי ובאזורים חקלאיים לשעבר, וחלקן נמצאות בתהליכי תכנון או במגע עם תוכניות המתאר של העיר. זה בדיוק סוג הקרקע שבו בדיקה תכנונית נכונה עושה את ההבדל בין השקעה טובה לטעות.',
        ] },
        { h2: 'סוגי נכסים וקרקעות שנפגוש בעיר', bullets: ['מגרשים לצמודי קרקע בשכונות הוותיקות ובהרחבות.', 'קרקעות פרטיות בייעוד חקלאי או בתהליכי שינוי ייעוד בשולי העיר.', 'דירות בבנייה רוויה חדשה, בעיקר במזרח העיר.', 'בתים פרטיים ודו-משפחתיים במגדיאל, רמתיים והדר.', 'התחדשות עירונית בשכונות הוותיקות.'] },
        { h2: 'למה חשוב ידע מקומי דווקא כאן', paras: ['בהוד השרון ההבדל בין שתי חלקות סמוכות יכול להיות עצום — אחת בתוך תוכנית מאושרת ואחת מחוצה לה; אחת בבעלות פרטית מלאה ואחת במושע עם עשרות שותפים. תוכניות המתאר של העיר, גבולות השטח הבנוי ותשתיות התחבורה (כביש 4, כביש 531, הרכבת) מכתיבים איפה יש פוטנציאל. אנחנו כאן, ואנחנו רואים את זה בשטח.'] },
        { h2: 'מה אנחנו עושים בהוד השרון', bullets: ['**לבעלי קרקע** — בדיקת ייעוד וזכויות, הערכת שווי, ייצוג מול רוכשים וחברות בנייה, וקידום תוכניות.', '**לרוכשים ומשקיעים** — איתור מגרשים וקרקעות, כולל בלעדיים, ובדיקת נאותות.', '**למוכרים** — שיווק ומכירת דירות ובתים בעיר.', '**ליזמים** — קרקע לפרויקט הבא ושיווק הפרויקט.'] },
      ],
      faq: [
        { q: 'מי יכול לעזור לי למכור נכס בהוד השרון?', a: 'אפיק הנחל פועלת מהוד השרון ומלווה מכירת דירות, בתים, מגרשים וקרקעות בעיר — מהערכת שווי ותוכנית שיווק ועד לחוזה ולרישום. שיחת ייעוץ ראשונה ללא עלות.' },
        { q: 'יש לי קרקע חקלאית בהוד השרון — מה אפשר לעשות איתה?', a: 'קודם לבדוק: מה הייעוד לפי התב"ע, האם הקרקע נכללת בתוכנית מתאר או בתוכנית בהכנה, מה מבנה הבעלות, ומה המגבלות. רק אחר כך אפשר להחליט בין מכירה, המתנה, קידום תוכנית או שותפות עם יזם. אנחנו עושים את הבדיקה הזו כשלב ראשון.' },
        { q: 'האם יש בהוד השרון עדיין מגרשים לצמוד קרקע?', a: 'כן, בעיקר בשכונות הוותיקות (מגדיאל, רמתיים, הדר) ובהרחבות, אבל ההיצע מוגבל וחלק גדול מהעסקאות נסגרות לפני שהן מגיעות לפורטלים. לכן כדאי להיות במאגר של חברה מקומית.' },
        { q: 'איפה נמצא המשרד של אפיק הנחל בהוד השרון?', a: 'ברחוב הנגר 24, מגדלי Amy — מגדל A. ראשון–חמישי 09:00–19:00, שישי 09:00–14:00.' },
      ],
    },
    en: {
      h1: 'Real estate and land in Hod Hasharon — development, marketing and brokerage', cardTitle: 'Hod Hasharon', placeName: 'Hod Hasharon',
      metaTitle: 'Real Estate in Hod Hasharon: Land, Plots, Development & Property Marketing | Afik Hanahal',
      description: 'Afik Hanahal works from Hod Hasharon: brokerage and marketing of land and plots, development and plan promotion, and selling apartments and houses in the city. What characterises the Hod Hasharon market and what matters to owners and buyers.',
      summary: 'Hod Hasharon is a family city in the heart of the Sharon, with much low-rise and detached housing beside new high-density neighbourhoods, and a stock of private land still going through planning. Afik Hanahal is based in the city (24 HaNagar St.) and works here daily: brokering and marketing land and plots, promoting plans and rezoning, and selling apartments and houses.',
      sections: [
        { h2: 'What characterises real estate in Hod Hasharon', paras: ['Hod Hasharon was formed by merging veteran colonies and moshavim — Magdiel, Ramatayim, Hadar and Ramat Hadar — so it combines old neighbourhoods with large plots and detached homes with new high-density neighbourhoods (such as the 1200 area in the east) and new infrastructure. It borders Kfar Saba, Ra\'anana and Ramat Hasharon and enjoys strong family demand.', 'For land it is especially interesting: private land still exists at the edges of the built-up area and in former agricultural zones, some in planning processes or touching the city\'s master plans. That is exactly the kind of land where correct planning due diligence separates a good investment from a mistake.'] },
        { h2: 'Property and land types in the city', bullets: ['Plots for detached homes in the older neighbourhoods and expansions.', 'Private land under agricultural designation or in rezoning at the city edges.', 'Apartments in new high-density construction, mainly in the east.', 'Detached and semi-detached houses in Magdiel, Ramatayim and Hadar.', 'Urban renewal in the older neighbourhoods.'] },
        { h2: 'Why local knowledge matters here', paras: ['In Hod Hasharon the difference between two adjacent parcels can be huge — one inside an approved plan and one outside; one fully privately owned and one in undivided shares with dozens of partners. The city\'s master plans, the built-up boundary and transport (Highway 4, Road 531, the railway) dictate where the potential is. We are here and we see it on the ground.'] },
        { h2: 'What we do in Hod Hasharon', bullets: ['**Landowners** — zoning and rights checks, valuation, representation opposite buyers and builders, plan promotion.', '**Buyers and investors** — sourcing plots and land, including exclusives, with due diligence.', '**Sellers** — marketing and selling apartments and houses.', '**Developers** — land for the next project and project marketing.'] },
      ],
      faq: [
        { q: 'Who can help me sell a property in Hod Hasharon?', a: 'Afik Hanahal works from Hod Hasharon and handles sales of apartments, houses, plots and land in the city — from valuation and marketing plan to contract and registration. Free first consultation.' },
        { q: 'I own agricultural land in Hod Hasharon — what can I do with it?', a: 'First check: the designation under the zoning plan, whether it falls within a master plan or a plan in preparation, the ownership structure and the constraints. Only then decide between selling, waiting, promoting a plan or partnering with a developer. We do this check as step one.' },
        { q: 'Are there still plots for detached homes in Hod Hasharon?', a: 'Yes, mainly in the older neighbourhoods (Magdiel, Ramatayim, Hadar) and expansions, but supply is limited and many deals close before reaching the portals — so it pays to be on a local company\'s list.' },
        { q: 'Where is Afik Hanahal\'s office in Hod Hasharon?', a: '24 HaNagar St., Amy Towers — Tower A. Sun–Thu 09:00–19:00, Fri 09:00–14:00.' },
      ],
    },
  },
  {
    slug: 'kfar-saba', cta: 'sell', updated: U,
    related: { services: ['sell-your-property', 'land-brokerage', 'land-investment'], areas: ['hod-hasharon', 'raanana', 'sharon-region'], guides: ['how-to-sell-property', 'property-valuation'], glossary: ['urban-renewal', 'tama-38', 'pinui-binui', 'building-rights'] },
    he: {
      h1: 'נדל"ן בכפר סבא — מכירת נכסים, קרקעות והתחדשות עירונית', cardTitle: 'כפר סבא', placeName: 'כפר סבא',
      metaTitle: 'נדל"ן בכפר סבא: מכירת דירות ובתים, קרקעות ומגרשים | אפיק הנחל',
      description: 'שיווק ומכירת דירות, בתים ומגרשים בכפר סבא, וליווי בעלי קרקע בשולי העיר. מה מאפיין את שוק הנדל"ן בכפר סבא, מהשכונות הוותיקות ועד כפר סבא הירוקה.',
      summary: 'כפר סבא היא אחת הערים המבוקשות בשרון — עיר ותיקה עם מרכז עירוני חי, שכונות חדשות בצפון (כפר סבא הירוקה) ומזרח, והתחדשות עירונית נרחבת בשכונות הוותיקות. אפיק הנחל, שבסיסה בהוד השרון הסמוכה, משווקת ומוכרת נכסים בכפר סבא ומלווה בעלי קרקע ומגרשים בעיר ובסביבתה.',
      sections: [
        { h2: 'מה מאפיין את הנדל"ן בכפר סבא', paras: ['כפר סבא משלבת מרכז עיר ותיק ומבוקש, שכונות של שנות ה-70–90 שעוברות היום התחדשות עירונית (תמ"א 38 ופינוי-בינוי), ושכונות חדשות של בנייה רוויה בצפון ובמזרח העיר. הרכבת, כביש 531 וכביש 4 מחברים אותה למרכז ומחזקים את הביקוש של משפחות צעירות ומשפרי דיור.', 'קרקעות פרטיות בכפר סבא נמצאות בעיקר בשוליים — בגבול עם הוד השרון ורעננה ובאזורים החקלאיים לשעבר — וחלקן נוגעות בתוכניות המתאר. במרכז העיר הערך נובע מזכויות בנייה ומפוטנציאל ההתחדשות.'] },
        { h2: 'סוגי נכסים', bullets: ['דירות 3–5 חדרים בבנייה רוויה, ותיקה וחדשה.', 'דירות בפרויקטי התחדשות עירונית.', 'בתים פרטיים ודו-משפחתיים בשכונות הוותיקות.', 'מגרשים וקרקעות בשולי העיר.'] },
        { h2: 'מה חשוב לדעת למוכר בכפר סבא', bullets: ['בבניין ותיק — האם יש הליך התחדשות עירונית בדרך? זה משפיע על המחיר ועל קהל היעד.', 'התאמה בין המצב בפועל להיתר, במיוחד בבתים פרטיים עם תוספות.', 'תמחור לפי עסקאות אמיתיות בשכונה, לא לפי מודעות.', 'תזמון — משפרי דיור רבים בכפר סבא מוכרים וקונים במקביל.'] },
        { h2: 'מה אנחנו עושים בכפר סבא', bullets: ['שיווק ומכירת דירות ובתים.', 'ליווי בעלי מגרשים וקרקעות בשולי העיר — בדיקה, הערכה, שיווק.', 'איתור נכסים ומגרשים לרוכשים ולמשקיעים.'] },
      ],
      faq: [
        { q: 'כמה זמן לוקח למכור דירה בכפר סבא?', a: 'דירה מתומחרת נכון ומוצגת היטב בכפר סבא נמכרת לרוב תוך שבועות עד חודשים ספורים, כי הביקוש בעיר יציב. תמחור גבוה מדי מאריך את התהליך ולעיתים פוגע במחיר הסופי.' },
        { q: 'הבניין שלי בכפר סבא בתהליך תמ"א 38 — האם למכור עכשיו?', a: 'תלוי בשלב: חתימות, היתר או ביצוע. ככל שהפרויקט מתקדם ומאושר, הוודאות (והמחיר) עולים, אבל גם ההמתנה מתארכת. כדאי לבדוק את מצב הפרויקט ואת חוזה היזם לפני ההחלטה.' },
        { q: 'יש לי מגרש בגבול כפר סבא–הוד השרון, מה הוא שווה?', a: 'השווי נקבע בעיקר לפי הייעוד והזכויות, ולא לפי המיקום בלבד. נבדוק את התב"ע, את תוכניות המתאר ואת מבנה הבעלות, ורק אז נעריך. שיחה ראשונה ללא עלות.' },
      ],
    },
    en: {
      h1: 'Real estate in Kfar Saba — selling property, land and urban renewal', cardTitle: 'Kfar Saba', placeName: 'Kfar Saba',
      metaTitle: 'Real Estate in Kfar Saba: Selling Apartments & Houses, Land and Plots | Afik Hanahal',
      description: 'Marketing and selling apartments, houses and plots in Kfar Saba, and supporting landowners at the city edges. What characterises the Kfar Saba market, from the veteran neighbourhoods to Green Kfar Saba.',
      summary: 'Kfar Saba is one of the most sought-after cities in the Sharon — a veteran city with a lively centre, new neighbourhoods in the north (Green Kfar Saba) and east, and extensive urban renewal in the older neighbourhoods. Afik Hanahal, based in neighbouring Hod Hasharon, markets and sells property in Kfar Saba and supports owners of land and plots in and around the city.',
      sections: [
        { h2: 'What characterises real estate in Kfar Saba', paras: ['Kfar Saba combines a sought-after old centre, 1970s–90s neighbourhoods now undergoing urban renewal (TAMA 38 and pinui-binui), and new high-density neighbourhoods in the north and east. The railway, Road 531 and Highway 4 connect it to the centre and strengthen demand from young families and upgraders.', 'Private land in Kfar Saba lies mainly at the edges — on the border with Hod Hasharon and Ra\'anana and in former agricultural zones — some touching the master plans. In the centre, value comes from building rights and renewal potential.'] },
        { h2: 'Property types', bullets: ['3–5 room apartments in old and new high-density buildings.', 'Apartments in urban renewal projects.', 'Detached and semi-detached houses in the older neighbourhoods.', 'Plots and land at the city edges.'] },
        { h2: 'What sellers in Kfar Saba should know', bullets: ['In an older building — is a renewal process under way? It affects price and audience.', 'Match between actual state and permit, especially in houses with additions.', 'Pricing by real neighbourhood deals, not listings.', 'Timing — many Kfar Saba upgraders sell and buy in parallel.'] },
        { h2: 'What we do in Kfar Saba', bullets: ['Marketing and selling apartments and houses.', 'Supporting plot and land owners at the edges — checks, valuation, marketing.', 'Sourcing property and plots for buyers and investors.'] },
      ],
      faq: [
        { q: 'How long does it take to sell an apartment in Kfar Saba?', a: 'A correctly priced, well presented apartment usually sells within weeks to a few months, because demand in the city is steady. Overpricing lengthens the process and can hurt the final price.' },
        { q: 'My building in Kfar Saba is in a TAMA 38 process — should I sell now?', a: 'It depends on the stage: signatures, permit or construction. As the project advances and is approved, certainty (and price) rise, but so does the wait. Check the project status and the developer\'s contract before deciding.' },
        { q: 'I own a plot on the Kfar Saba–Hod Hasharon border, what is it worth?', a: 'Value is set mainly by designation and rights, not location alone. We check the zoning plan, master plans and ownership structure, and only then estimate. First call is free.' },
      ],
    },
  },
  {
    slug: 'raanana', cta: 'sell', updated: U,
    related: { services: ['sell-your-property', 'rent-your-property', 'project-marketing'], areas: ['herzliya', 'kfar-saba', 'sharon-region'], guides: ['how-to-sell-property', 'property-valuation'], glossary: ['detached-house', 'penthouse', 'exclusivity', 'appraiser'] },
    he: {
      h1: 'נדל"ן ברעננה — מכירה, השכרה ושיווק נכסים', cardTitle: 'רעננה', placeName: 'רעננה',
      metaTitle: 'נדל"ן ברעננה: מכירת דירות ובתים, השכרה ושיווק נכסים | אפיק הנחל',
      description: 'שיווק ומכירת דירות, בתים פרטיים ונכסים להשכרה ברעננה. מה מאפיין את שוק הנדל"ן ברעננה — משכונות הווילות ועד נווה זמר ולב הפארק — ומה חשוב למוכר ולמשכיר.',
      summary: 'רעננה היא עיר איכות חיים בשרון עם ביקוש גבוה ויציב, ציבור רוכשים מגוון (כולל קהילה גדולה של עולים מארצות דוברות אנגלית), שכונות וילות ותיקות ושכונות חדשות בצפון העיר. אפיק הנחל משווקת ומוכרת דירות ובתים ברעננה ומלווה בעלי נכסים להשכרה.',
      sections: [
        { h2: 'מה מאפיין את הנדל"ן ברעננה', paras: ['רעננה ידועה בפארק העירוני הגדול, בחינוך ובאיכות החיים, ומושכת משפחות ומשפרי דיור מכל המרכז, וכן קהילה גדולה של עולים מצפון אמריקה, בריטניה וצרפת — עובדה שמשפיעה על סוגי הנכסים המבוקשים (בתים, דירות גן, פנטהאוזים) ועל דרכי השיווק. בצפון העיר נבנו בעשור האחרון שכונות חדשות (נווה זמר ולב הפארק), ובמרכז ובדרום נמצאות שכונות הווילות והבנייה הוותיקה.', 'היצע הקרקע הפנויה ברעננה קטן, ולכן הערך במרכז העיר נובע בעיקר מזכויות בנייה, מהתחדשות עירונית ומהביקוש הגבוה לבתים פרטיים.'] },
        { h2: 'סוגי נכסים', bullets: ['בתים פרטיים ווילות בשכונות הוותיקות.', 'דירות גן ופנטהאוזים בבנייה חדשה.', 'דירות 3–5 חדרים בבנייה רוויה.', 'נכסים להשכרה — ביקוש גבוה מרילוקיישן ומעולים.'] },
        { h2: 'מה חשוב לדעת למוכר ולמשכיר ברעננה', bullets: ['קהל הרוכשים דובר האנגלית דורש חומרי שיווק ושירות גם באנגלית.', 'בתים פרטיים — חשוב לבדוק היתרים, תוספות וזכויות בנייה נותרות; זה מרכיב מרכזי בשווי.', 'בהשכרה — ביקוש חזק לנכסים מרוהטים ולטווחים קצרים-בינוניים (רילוקיישן).', 'תמחור לפי עסקאות בשכונה הספציפית — ברעננה יש פערים משמעותיים בין שכונות.'] },
        { h2: 'מה אנחנו עושים ברעננה', bullets: ['שיווק ומכירת דירות, בתים ופנטהאוזים.', 'שיווק נכסים להשכרה ומציאת שוכרים.', 'שיווק בתי יוקרה באופן דיסקרטי.'] },
      ],
      faq: [
        { q: 'איך מוכרים בית פרטי ברעננה במחיר הנכון?', a: 'בודקים היתרים וזכויות בנייה נותרות (מרכיב מרכזי בשווי), משווים לעסקאות אחרונות בשכונה, מכינים את הבית לצילום, ומשווקים גם לקהל דובר האנגלית. אפיק הנחל מלווה את כל התהליך עד החוזה.' },
        { q: 'האם כדאי להשכיר דירה ברעננה מרוהטת?', a: 'לרוב כן — הביקוש מרילוקיישן ומעולים לדירות מרוהטות גבוה, וניתן לקבל שכר דירה גבוה יותר. חשוב חוזה מסודר וערבויות מתאימות.' },
        { q: 'האם אפיק הנחל משווקת נכסים ברעננה גם לקונים מחו"ל?', a: 'כן. חלק מהרוכשים ברעננה הם עולים ומשקיעים מחו"ל, ואנחנו מותאמים לכך בשיווק ובליווי, כולל תיאום עם עורכי דין ומייצגים בארץ.' },
      ],
    },
    en: {
      h1: 'Real estate in Ra\'anana — selling, renting and property marketing', cardTitle: 'Ra\'anana', placeName: "Ra'anana",
      metaTitle: 'Real Estate in Ra\'anana: Selling Apartments & Houses, Rentals and Marketing | Afik Hanahal',
      description: 'Marketing and selling apartments, houses and rental property in Ra\'anana. What characterises the Ra\'anana market — from the villa neighbourhoods to Neve Zemer and Lev HaPark — and what sellers and landlords should know.',
      summary: 'Ra\'anana is a quality-of-life city in the Sharon with high, steady demand, a diverse buyer public (including a large community of English-speaking immigrants), veteran villa neighbourhoods and new neighbourhoods in the north. Afik Hanahal markets and sells apartments and houses in Ra\'anana and supports owners of rental property.',
      sections: [
        { h2: 'What characterises real estate in Ra\'anana', paras: ['Ra\'anana is known for its large city park, education and quality of life, attracting families and upgraders from across the centre, plus a large community of immigrants from North America, the UK and France — which shapes the property types in demand (houses, garden apartments, penthouses) and how they are marketed. New neighbourhoods (Neve Zemer, Lev HaPark) were built in the north over the last decade; the centre and south hold the villa neighbourhoods and older construction.', 'Vacant land supply in Ra\'anana is small, so value in the centre comes mainly from building rights, urban renewal and strong demand for detached homes.'] },
        { h2: 'Property types', bullets: ['Detached houses and villas in the older neighbourhoods.', 'Garden apartments and penthouses in new construction.', '3–5 room apartments in high-density buildings.', 'Rentals — strong demand from relocation and immigrants.'] },
        { h2: 'What sellers and landlords in Ra\'anana should know', bullets: ['The English-speaking buyer public needs marketing materials and service in English.', 'Houses — check permits, additions and remaining building rights; a central value component.', 'Rentals — strong demand for furnished, short-to-medium term (relocation).', 'Price by deals in the specific neighbourhood — gaps between neighbourhoods are significant.'] },
        { h2: 'What we do in Ra\'anana', bullets: ['Marketing and selling apartments, houses and penthouses.', 'Marketing rentals and finding tenants.', 'Discreet marketing of luxury homes.'] },
      ],
      faq: [
        { q: 'How do I sell a house in Ra\'anana at the right price?', a: 'Check permits and remaining building rights (a central value component), compare recent neighbourhood deals, prepare the house for photography, and market to the English-speaking public too. Afik Hanahal supports the whole process to contract.' },
        { q: 'Should I rent my Ra\'anana apartment furnished?', a: 'Usually yes — relocation and immigrant demand for furnished apartments is high, and rent is higher. A proper lease and suitable guarantees are essential.' },
        { q: 'Does Afik Hanahal market Ra\'anana property to overseas buyers?', a: 'Yes. Part of Ra\'anana\'s buyers are immigrants and overseas investors, and our marketing and support are adapted, including coordination with lawyers and representatives in Israel.' },
      ],
    },
  },
  {
    slug: 'herzliya', cta: 'sell', updated: U,
    related: { services: ['sell-your-property', 'project-marketing', 'land-brokerage'], areas: ['raanana', 'sharon-region'], guides: ['how-to-sell-property', 'property-valuation'], glossary: ['penthouse', 'detached-house', 'appraiser', 'purchase-tax'] },
    he: {
      h1: 'נדל"ן בהרצליה — בתי יוקרה, דירות ונכסים למכירה', cardTitle: 'הרצליה', placeName: 'הרצליה',
      metaTitle: 'נדל"ן בהרצליה: מכירת בתי יוקרה, דירות ונכסים | אפיק הנחל',
      description: 'שיווק ומכירת בתי יוקרה, דירות ופנטהאוזים בהרצליה ובהרצליה פיתוח. מה מאפיין את שוק הנדל"ן בהרצליה ומה חשוב למוכרים ולרוכשים.',
      summary: 'הרצליה מחברת בין השרון לתל אביב: הרצליה פיתוח עם שכונת הווילות והחוף, מרכז העיר עם בנייה ותיקה והתחדשות, ושכונות חדשות כמו גליל ים והרצליה הילס. אפיק הנחל משווקת ומוכרת בתי יוקרה, דירות ופנטהאוזים בהרצליה, בדגש על שיווק דיסקרטי וממוקד.',
      sections: [
        { h2: 'מה מאפיין את הנדל"ן בהרצליה', paras: ['הרצליה היא עיר של קצוות: מצד אחד הרצליה פיתוח — אחת משכונות היוקרה המבוקשות בישראל, עם וילות, קרבה לים ולמרינה ולאזור ההייטק; ומצד שני מרכז העיר עם בנייה ותיקה שעוברת התחדשות עירונית, ושכונות חדשות (גליל ים, הרצליה הילס) שהביאו היצע גדול של דירות חדשות. הקרבה לתל אביב, לכביש 2 ולרכבת שומרת על ביקוש גבוה מקהל מגוון, כולל רוכשים מחו"ל.'] },
        { h2: 'סוגי נכסים', bullets: ['וילות ובתי יוקרה בהרצליה פיתוח.', 'פנטהאוזים ודירות יוקרה בבנייה חדשה.', 'דירות בבנייה ותיקה ובפרויקטי התחדשות במרכז העיר.', 'דירות חדשות בגליל ים והרצליה הילס.'] },
        { h2: 'מה חשוב לדעת למוכר בהרצליה', bullets: ['בנכסי יוקרה — שיווק דיסקרטי, סינון רוכשים והצגה לקהל ממוקד חשובים יותר מחשיפה רחבה.', 'רוכשים מחו"ל — ליווי משפטי ומיסויי מותאם (מס רכישה לתושב חוץ שונה).', 'בבתים — היתרים, זכויות בנייה נותרות ומצב הרישום קובעים חלק גדול מהשווי.', 'תמחור לפי עסקאות בפועל — בהרצליה הפער בין מחירי המודעות למחירי העסקאות יכול להיות גדול.'] },
        { h2: 'מה אנחנו עושים בהרצליה', bullets: ['שיווק ומכירת בתי יוקרה, דירות ופנטהאוזים.', 'ליווי רוכשים ומשקיעים, כולל מחו"ל.', 'שיווק פרויקטים ויחידות נותרות ליזמים.'] },
      ],
      faq: [
        { q: 'איך מוכרים בית יוקרה בהרצליה פיתוח?', a: 'בשיווק דיסקרטי וממוקד: הערכת שווי מקצועית, חומרים איכותיים, פנייה ישירה למאגר רוכשים ומשקיעים מתאימים בארץ ובחו"ל, סינון קפדני, וניהול משא ומתן שקט. פרסום המוני לרוב פוגע בנכסים כאלה.' },
        { q: 'האם רוכש מחו"ל משלם מס רכישה שונה?', a: 'כן. תושב חוץ אינו זכאי למדרגות המס המופחתות של "דירה יחידה" הניתנות לתושבי ישראל, ולכן חשוב לבדוק את המיסוי הצפוי לפני העסקה. אנחנו מפנים לייעוץ מס מתאים.' },
      ],
    },
    en: {
      h1: 'Real estate in Herzliya — luxury homes, apartments and property for sale', cardTitle: 'Herzliya', placeName: 'Herzliya',
      metaTitle: 'Real Estate in Herzliya: Selling Luxury Homes, Apartments & Property | Afik Hanahal',
      description: 'Marketing and selling luxury homes, apartments and penthouses in Herzliya and Herzliya Pituach. What characterises the Herzliya market and what sellers and buyers should know.',
      summary: 'Herzliya connects the Sharon with Tel Aviv: Herzliya Pituach with its villa neighbourhood and beach, the city centre with older construction and renewal, and new neighbourhoods such as Glil Yam and Herzliya Hills. Afik Hanahal markets and sells luxury homes, apartments and penthouses in Herzliya, with an emphasis on discreet, targeted marketing.',
      sections: [
        { h2: 'What characterises real estate in Herzliya', paras: ['Herzliya is a city of contrasts: Herzliya Pituach — one of Israel\'s most sought-after luxury neighbourhoods, with villas near the sea, the marina and the tech district — and the city centre with older construction undergoing renewal, plus new neighbourhoods (Glil Yam, Herzliya Hills) that brought a large supply of new apartments. Proximity to Tel Aviv, Highway 2 and the railway keeps demand high from a diverse public, including overseas buyers.'] },
        { h2: 'Property types', bullets: ['Villas and luxury homes in Herzliya Pituach.', 'Penthouses and luxury apartments in new construction.', 'Apartments in older buildings and renewal projects in the centre.', 'New apartments in Glil Yam and Herzliya Hills.'] },
        { h2: 'What sellers in Herzliya should know', bullets: ['Luxury property — discreet marketing, buyer screening and targeted presentation matter more than broad exposure.', 'Overseas buyers — tailored legal and tax support (purchase tax for non-residents differs).', 'Houses — permits, remaining building rights and registration status set much of the value.', 'Price by actual deals — the gap between listing prices and deal prices in Herzliya can be large.'] },
        { h2: 'What we do in Herzliya', bullets: ['Marketing and selling luxury homes, apartments and penthouses.', 'Supporting buyers and investors, including from abroad.', 'Marketing projects and remaining units for developers.'] },
      ],
      faq: [
        { q: 'How do you sell a luxury home in Herzliya Pituach?', a: 'Discreetly and precisely: a professional valuation, quality materials, direct outreach to suitable buyers and investors in Israel and abroad, careful screening and quiet negotiation. Mass advertising usually hurts such properties.' },
        { q: 'Do overseas buyers pay different purchase tax?', a: 'Yes. A non-resident is not entitled to the reduced "single home" brackets available to Israeli residents, so the expected tax must be checked before the deal. We refer to suitable tax advice.' },
      ],
    },
  },
  {
    slug: 'sharon-region', cta: 'land', updated: U,
    related: { services: ['land-brokerage', 'real-estate-development', 'land-investment'], areas: ['hod-hasharon', 'kfar-saba', 'raanana', 'herzliya'], guides: ['land-due-diligence-checklist', 'agricultural-land-investment', 'rezoning-process', 'what-is-real-estate-development'], glossary: ['private-land', 'agricultural-land', 'taba', 'district-committee', 'vatmal'] },
    he: {
      h1: 'נדל"ן וקרקעות בשרון — המדריך של אפיק הנחל לאזור', cardTitle: 'אזור השרון', placeName: 'השרון',
      metaTitle: 'נדל"ן וקרקעות בשרון: הוד השרון, כפר סבא, רעננה, הרצליה ורמת השרון | אפיק הנחל',
      description: 'למה השרון הוא אחד מאזורי הנדל"ן המבוקשים בישראל, איפה נמצאות הקרקעות הפרטיות, מה קובע את הערך, ואיך אפיק הנחל מלווה בעלי קרקע, רוכשים ויזמים בכל ערי השרון.',
      summary: 'השרון — הוד השרון, כפר סבא, רעננה, הרצליה, רמת השרון, נתניה והמועצות שביניהן — הוא רצועה עירונית-חקלאית צפונית לתל אביב שמשלבת ביקוש גבוה למגורים, איכות חיים, ותשתיות תחבורה מרכזיות. בשונה מגוש דן, עדיין יש בשרון קרקעות פרטיות בשולי הערים ובמושבים, וזו הסיבה שהאזור הוא מוקד של יזמות, שינויי ייעוד והשקעות קרקע. אפיק הנחל פועלת מהוד השרון ומלווה עסקאות קרקע ונכסים בכל האזור.',
      sections: [
        { h2: 'למה השרון', bullets: ['**ביקוש יציב** — משפחות, משפרי דיור, עולים ומשקיעים, בקרבה לתל אביב ולמוקדי התעסוקה.', '**תחבורה** — כביש 4, כביש 2, כביש 6, כביש 531 ותחנות רכבת בהוד השרון–סוקולוב, כפר סבא, רעננה והרצליה.', '**היצע קרקע מוגבל** — הערים מוקפות בשטחים חקלאיים ובמושבים; כל תוכנית מתאר חדשה מייצרת הזדמנויות מוגדרות.', '**איכות חיים** — פארקים, חינוך ומרקם עירוני-כפרי שמושך רוכשים גם במחירים גבוהים.'] },
        { h2: 'איפה נמצאות הקרקעות הפרטיות בשרון', paras: ['בעיקר בשוליים: בין הוד השרון לכפר סבא ורעננה, סביב המושבים והכפרים (למשל באזורי המועצות האזוריות דרום השרון ולב השרון), ובאזורים חקלאיים לשעבר שנוגעים בתוכניות המתאר של הערים. חלק מהקרקעות בבעלות פרטית מלאה (טאבו), חלק במושע עם שותפים רבים, וחלק בהסדרים מול רמ"י — וההבדל הזה קובע הרבה מהשווי ומאפשרויות הפעולה.'] },
        { h2: 'מה קובע את ערך הקרקע בשרון', table: { head: ['גורם', 'למה זה משנה'], rows: [
          ['ייעוד לפי התב"ע', 'חקלאי, מגורים, מסחר — ההבדל בשווי יכול להיות פי כמה'], ['זכויות בנייה', 'כמה יחידות / כמה שטח מותר לבנות'], ['תוכניות מתאר ותכנון עתידי', 'האם הקרקע נכללת בהרחבה עירונית מתוכננת'],
          ['מבנה בעלות', 'חלקה נפרדת לעומת מושע עם שותפים רבים'], ['מרחק מהבינוי והתשתיות', 'ככל שקרוב יותר, הסיכוי לפיתוח גבוה יותר'], ['מגבלות', 'שימור, תשתיות לאומיות, שטחים פתוחים, רצועות דרך'], ['מיסוי והיטלים', 'מס שבח, מס רכישה, היטל השבחה — משפיעים על הנטו'],
        ] } },
        { h2: 'ערי השרון — בקצרה', bullets: ['[הוד השרון](/areas/hod-hasharon/) — עיר משפחתית עם צמודי קרקע, שכונות חדשות במזרח וקרקעות בשוליים. הבסיס שלנו.', '[כפר סבא](/areas/kfar-saba/) — עיר ותיקה ומבוקשת, התחדשות עירונית נרחבת, קרקעות בשוליים.', '[רעננה](/areas/raanana/) — איכות חיים, קהילה דוברת אנגלית, בתים פרטיים ושכונות חדשות בצפון.', '[הרצליה](/areas/herzliya/) — הרצליה פיתוח ובתי יוקרה, לצד התחדשות ושכונות חדשות.', 'רמת השרון ונתניה — פעילות שוטפת של החברה גם בהן.'] },
        { h2: 'מה אנחנו עושים בשרון', bullets: ['[שיווק ותיווך קרקעות ומגרשים](/services/land-brokerage/) — כולל בלעדיים.', '[יזמות וקידום תוכניות](/services/real-estate-development/) — שינויי ייעוד והשבחה.', '[ליווי משקיעים בקרקע](/services/land-investment/).', '[מכירת נכסים](/services/sell-your-property/) ו[השכרה](/services/rent-your-property/) בכל ערי השרון.'] },
      ],
      faq: [
        { q: 'איפה כדאי לקנות קרקע בשרון?', a: 'אין תשובה אחת — הערך נקבע לפי ייעוד, זכויות, תוכניות מתאר ומבנה בעלות, לא לפי שם העיר. קרקע צמודה לשטח בנוי עם תוכנית מתאר שמצביעה על הרחבה שווה יותר מקרקע רחוקה "עם פוטנציאל". הבדיקה התכנונית קודמת לכל החלטה.' },
        { q: 'כמה עולה קרקע בשרון?', a: 'הטווח רחב מאוד: מגרש לבנייה עם זכויות ברורות נמכר במיליוני שקלים; קרקע חקלאית נסחרת לפי דונם ובמחירים נמוכים בהרבה, שמשקפים סיכון ואי-ודאות. לקבלת הערכה לקרקע ספציפית — פנו אלינו.' },
        { q: 'למה עדיין יש קרקעות פרטיות בשרון?', a: 'ההיסטוריה ההתיישבותית של האזור — מושבות ומושבים ותיקים — הותירה חלקות פרטיות רבות בידי משפחות ויורשים. חלקן עדיין חקלאיות, וחלקן נוגעות בהרחבות העירוניות. זה מה שהופך את השרון למוקד של יזמות ושינויי ייעוד.' },
      ],
    },
    en: {
      h1: 'Real estate and land in the Sharon region — Afik Hanahal\'s area guide', cardTitle: 'Sharon region', placeName: 'Sharon region',
      metaTitle: 'Real Estate & Land in the Sharon: Hod Hasharon, Kfar Saba, Ra\'anana, Herzliya & Ramat Hasharon | Afik Hanahal',
      description: 'Why the Sharon is one of Israel\'s most sought-after real estate regions, where the private land is, what sets value, and how Afik Hanahal supports landowners, buyers and developers across the Sharon.',
      summary: 'The Sharon — Hod Hasharon, Kfar Saba, Ra\'anana, Herzliya, Ramat Hasharon, Netanya and the councils between them — is an urban-agricultural belt north of Tel Aviv combining strong housing demand, quality of life and major transport. Unlike Gush Dan, the Sharon still has private land at the city edges and in the moshavim, which is why it is a focus of development, rezoning and land investment. Afik Hanahal works from Hod Hasharon and supports land and property deals across the region.',
      sections: [
        { h2: 'Why the Sharon', bullets: ['**Steady demand** — families, upgraders, immigrants and investors, close to Tel Aviv and employment hubs.', '**Transport** — Highways 4, 2, 6, Road 531 and railway stations in Hod Hasharon–Sokolov, Kfar Saba, Ra\'anana and Herzliya.', '**Limited land supply** — cities ringed by agricultural areas and moshavim; every new master plan creates defined opportunities.', '**Quality of life** — parks, education and an urban-rural fabric that attracts buyers even at high prices.'] },
        { h2: 'Where the private land is', paras: ['Mainly at the edges: between Hod Hasharon, Kfar Saba and Ra\'anana, around the moshavim and villages (e.g. the Drom HaSharon and Lev HaSharon regional councils), and in former agricultural zones touching the cities\' master plans. Some land is fully privately owned (Tabu), some is in undivided shares with many partners, and some sits under Israel Land Authority arrangements — a difference that sets much of the value and the options.'] },
        { h2: 'What sets land value in the Sharon', table: { head: ['Factor', 'Why it matters'], rows: [['Designation under the zoning plan', 'Agricultural, residential, commercial — value can differ several-fold'], ['Building rights', 'How many units / how much floor area may be built'], ['Master plans and future planning', 'Whether the land falls within a planned urban expansion'], ['Ownership structure', 'Separate parcel versus undivided shares with many partners'], ['Distance from development and infrastructure', 'The closer, the higher the development odds'], ['Constraints', 'Conservation, national infrastructure, open spaces, road corridors'], ['Taxes and levies', 'Capital gains, purchase tax, betterment levy — they set the net']] } },
        { h2: 'Sharon cities in brief', bullets: ['[Hod Hasharon](/en/areas/hod-hasharon/) — family city with detached homes, new eastern neighbourhoods and edge land. Our base.', '[Kfar Saba](/en/areas/kfar-saba/) — veteran, sought-after, extensive urban renewal, edge land.', '[Ra\'anana](/en/areas/raanana/) — quality of life, English-speaking community, houses and new northern neighbourhoods.', '[Herzliya](/en/areas/herzliya/) — Herzliya Pituach and luxury homes beside renewal and new neighbourhoods.', 'Ramat Hasharon and Netanya — ongoing activity as well.'] },
        { h2: 'What we do in the Sharon', bullets: ['[Land and plot marketing and brokerage](/en/services/land-brokerage/) — including exclusives.', '[Development and plan promotion](/en/services/real-estate-development/) — rezoning and improvement.', '[Land investment support](/en/services/land-investment/).', '[Selling](/en/services/sell-your-property/) and [renting out](/en/services/rent-your-property/) property across the Sharon.'] },
      ],
      faq: [
        { q: 'Where should I buy land in the Sharon?', a: 'There is no single answer — value follows designation, rights, master plans and ownership structure, not the city name. Land adjoining a built-up area with a master plan pointing to expansion is worth more than distant land "with potential". Planning due diligence precedes any decision.' },
        { q: 'How much does land cost in the Sharon?', a: 'The range is very wide: a building plot with clear rights sells for millions of shekels; agricultural land trades per dunam at far lower prices that reflect risk and uncertainty. For an estimate on specific land — contact us.' },
        { q: 'Why is there still private land in the Sharon?', a: 'The region\'s settlement history — veteran colonies and moshavim — left many private parcels with families and heirs. Some are still agricultural and some touch the urban expansions. That is what makes the Sharon a focus of development and rezoning.' },
      ],
    },
  },
  {
    slug: 'ramat-hasharon', cta: 'sell', updated: U,
    related: { services: ['sell-your-property', 'project-marketing', 'land-brokerage', 'project-management-supervision'], areas: ['herzliya', 'hod-hasharon', 'sharon-region'], guides: ['property-valuation', 'how-to-sell-property', 'construction-supervision'], glossary: ['detached-house', 'building-rights', 'boutique-project', 'betterment-levy', 'urban-renewal'] },
    he: {
      h1: 'נדל"ן ברמת השרון — בתים פרטיים, מגרשים ופרויקטי בוטיק', cardTitle: 'רמת השרון', placeName: 'רמת השרון',
      metaTitle: 'נדל"ן ברמת השרון: מכירת בתים פרטיים, מגרשים ופרויקטים | אפיק הנחל',
      description: 'שיווק ומכירת בתים פרטיים, מגרשים ודירות ברמת השרון, ליווי בעלי מגרשים בבנייה ובהשבחה ושיווק פרויקטי בוטיק. מה מאפיין את שוק הנדל"ן ברמת השרון ומה חשוב לדעת למוכר.',
      summary: 'רמת השרון היא מהערים היקרות בישראל: עיר קטנה יחסית בין תל אביב להרצליה, עם שכונות של בתים פרטיים על מגרשים גדולים, ביקוש יציב וקרקע מעטה. אפיק הנחל משווקת בתים ומגרשים ברמת השרון, מלווה בעלי מגרשים ששוקלים לבנות, לפצל או להשביח, ומשווקת פרויקטי בוטיק בעיר.',
      sections: [
        { h2: 'מה מאפיין את הנדל"ן ברמת השרון', paras: ['רמת השרון גובלת בתל אביב מדרום ובהרצליה מצפון, ורוב שטחה הבנוי הוא שכונות ותיקות של בתים פרטיים ודו-משפחתיים על מגרשים של חצי דונם ויותר. בשנים האחרונות העיר עוברת ציפוף מתון: בתים ישנים נהרסים ומוחלפים בבתים חדשים, בדו-משפחתיים או בפרויקטי בוטיק, ובשולי העיר מתוכננות שכונות חדשות.', 'המשמעות למוכרים ולבעלי מגרשים: חלק גדול משווי הנכס הוא שווי הקרקע וזכויות הבנייה, לא הבית הקיים. לכן תמחור נכון ברמת השרון מתחיל בבדיקת התב"ע והזכויות, ולא בהשוואת "מחיר למ"ר בנוי".'] },
        { h2: 'סוגי נכסים', bullets: ['בתים פרטיים ווילות בשכונות הוותיקות.', 'מגרשים לבנייה עצמית ולבנייה של דו-משפחתי.', 'דירות גן ופנטהאוזים בפרויקטי בוטיק.', 'דירות בבנייה רוויה במרכז העיר ובשכונות החדשות.'] },
        { h2: 'מה חשוב לדעת למוכר ברמת השרון', bullets: ['**קרקע מול מבנה** — בבית ישן על מגרש גדול, שווי ההריסה עשוי להיות גבוה משווי הבית; קהל היעד הוא יזמים ומשפחות שבונות, לא רק "קונים של בית".', '**יתרת זכויות ותוכניות חדשות** — תוספת זכויות מגדילה שווי אך גם עלולה לגרור היטל השבחה במכירה.', '**חריגות בנייה** — תוספות ללא היתר שכיחות בבתים ותיקים ומסבכות עסקה; בודקים מראש.', '**בנייה במקום מכירה** — לבעלי מגרש עם זכויות לשתי יחידות שווה לבחון בניית דו-משפחתי ומכירת יחידה, בליווי ניהול ופיקוח.'] },
        { h2: 'מה אנחנו עושים ברמת השרון', bullets: ['שיווק ומכירת בתים פרטיים, מגרשים ודירות.', 'בדיקת זכויות והערכת שווי לבעלי מגרשים ששוקלים למכור, לבנות או להשביח.', 'ניהול ופיקוח על בנייה של בית או דו-משפחתי עבור בעלי מגרש.', 'שיווק פרויקטי בוטיק ובתי יוקרה עבור יזמים ובעלי נכסים.'] },
      ],
      faq: [
        { q: 'יש לי בית ישן ברמת השרון — למכור כמו שהוא או להרוס ולבנות?', a: 'תלוי בזכויות, בתקציב ובזמן. אם המגרש מאפשר שתי יחידות, בנייה ומכירה של יחידה אחת יכולה להשאיר אתכם עם בית חדש בעלות נמוכה, אבל זה פרויקט של שנתיים ומעלה עם סיכון ביצוע. נבדוק יחד את שני התרחישים במספרים.' },
        { q: 'מה שווה מגרש ברמת השרון?', a: 'השווי נגזר מזכויות הבנייה, מספר היחידות המותר, גודל המגרש ומיקומו בשכונה. שני מגרשים באותו רחוב יכולים להיות שווים סכומים שונים מאוד. בדיקת תב"ע ושומה הן הצעד הראשון.' },
        { q: 'האם יש קרקעות פנויות ברמת השרון?', a: 'מעט מאוד. רוב "המגרשים" בעיר הם בתים ישנים שנמכרים לצורך הריסה ובנייה. קרקעות בשולי העיר כלולות בתוכניות חדשות, ובודקים אותן לפי מצבן התכנוני.' },
      ],
    },
    en: {
      h1: 'Real estate in Ramat Hasharon — detached houses, plots and boutique projects', cardTitle: 'Ramat Hasharon', placeName: 'Ramat Hasharon',
      metaTitle: 'Real Estate in Ramat Hasharon: Selling Houses, Plots and Projects | Afik Hanahal',
      description: 'Marketing and selling detached houses, plots and apartments in Ramat Hasharon, supporting plot owners in building and upgrading, and marketing boutique projects. What characterises the Ramat Hasharon market and what sellers should know.',
      summary: 'Ramat Hasharon is one of Israel\'s most expensive cities: a relatively small city between Tel Aviv and Herzliya, with neighbourhoods of detached houses on large plots, steady demand and little land. Afik Hanahal markets houses and plots in Ramat Hasharon, supports plot owners considering building, splitting or upgrading, and markets boutique projects in the city.',
      sections: [
        { h2: 'What characterises real estate in Ramat Hasharon', paras: ['Ramat Hasharon borders Tel Aviv to the south and Herzliya to the north, and most of its built-up area is veteran neighbourhoods of detached and semi-detached houses on plots of half a dunam and more. In recent years the city is densifying gently: old houses are demolished and replaced by new houses, semi-detached pairs or boutique projects, and new neighbourhoods are planned at the edges.', 'What this means for sellers and plot owners: a large part of a property\'s value is land value and building rights, not the existing house. Correct pricing in Ramat Hasharon therefore starts with checking the plan and rights, not with comparing "price per built m²".'] },
        { h2: 'Property types', bullets: ['Detached houses and villas in the veteran neighbourhoods.', 'Plots for self-build and for semi-detached pairs.', 'Garden apartments and penthouses in boutique projects.', 'Apartments in high-density buildings in the city centre and new neighbourhoods.'] },
        { h2: 'What sellers in Ramat Hasharon should know', bullets: ['**Land vs. structure** — for an old house on a large plot, demolition value may exceed the house\'s value; the audience is developers and families building, not only "house buyers".', '**Unused rights and new plans** — added rights raise value but may also trigger a betterment levy on sale.', '**Building deviations** — unpermitted additions are common in older houses and complicate a deal; check in advance.', '**Building instead of selling** — plot owners with rights for two units should consider building a semi-detached pair and selling one, with management and supervision.'] },
        { h2: 'What we do in Ramat Hasharon', bullets: ['Marketing and selling houses, plots and apartments.', 'Rights checks and valuation for plot owners considering selling, building or upgrading.', 'Managing and supervising construction of a house or semi-detached pair for plot owners.', 'Marketing boutique projects and luxury homes for developers and owners.'] },
      ],
      faq: [
        { q: 'I have an old house in Ramat Hasharon — sell as is, or demolish and build?', a: 'It depends on rights, budget and time. If the plot allows two units, building and selling one can leave you with a new house at low cost, but it is a two-year-plus project with execution risk. We will run both scenarios with you in numbers.' },
        { q: 'What is a plot in Ramat Hasharon worth?', a: 'Value derives from building rights, the permitted number of units, plot size and location within the neighbourhood. Two plots on the same street can be worth very different sums. A plan check and valuation are the first step.' },
        { q: 'Is there vacant land in Ramat Hasharon?', a: 'Very little. Most "plots" in the city are old houses sold for demolition and rebuilding. Land at the city edges is covered by new plans and is assessed by its planning status.' },
      ],
    },
  },
  {
    slug: 'central-israel', cta: 'land', updated: U,
    related: { services: ['land-brokerage', 'land-investment', 'real-estate-development', 'project-management-supervision'], areas: ['sharon-region', 'hod-hasharon', 'kfar-saba', 'raanana', 'herzliya', 'ramat-hasharon'], guides: ['land-due-diligence-checklist', 'rezoning-process', 'agricultural-land-investment', 'what-is-real-estate-development'], glossary: ['private-land', 'agricultural-land', 'vatmal', 'district-committee', 'taba'] },
    he: {
      h1: 'קרקעות ונדל"ן במרכז הארץ — איתור, שיווק ויזמות', cardTitle: 'מרכז הארץ', placeName: 'מחוז המרכז',
      metaTitle: 'קרקעות, מגרשים ונדל"ן במרכז הארץ: איתור, שיווק ויזמות | אפיק הנחל',
      description: 'איתור ושיווק קרקעות ומגרשים במרכז הארץ, ליווי בעלי קרקע פרטית וייזום פרויקטים: מהשרון דרך גוש דן ועד השפלה. מה מאפיין את שוק הקרקעות במחוז המרכז ומה בודקים לפני עסקה.',
      summary: 'מרכז הארץ הוא האזור עם הביקוש הגבוה ביותר לדיור בישראל ועם היצע הקרקע המצומצם ביותר, ולכן זירת הפעילות המרכזית של תוכניות ותמ"ל, שינויי ייעוד והתחדשות עירונית. אפיק הנחל, שבסיסה בהוד השרון, פועלת בשרון ובמחוז המרכז: איתור ושיווק קרקעות פרטיות ומגרשים, ליווי בעלי קרקע, ייזום וניהול פרויקטים.',
      sections: [
        { h2: 'מה מאפיין את שוק הקרקעות במרכז', paras: ['במרכז הארץ נפגשים שלושה כוחות: ביקוש גבוה ויציב, מעט קרקע פנויה, ומדיניות ממשלתית שמקדמת תוכניות דיור גדולות (ותמ"ל, הסכמי גג עם רשויות) על קרקעות חקלאיות בשולי הערים. התוצאה היא שוק שבו קרקע חקלאית פרטית בגבול הבנוי מקבלת תשומת לב רבה, ולעיתים גם מחירים שמניחים הפשרה שטרם התרחשה.', 'מחוז המרכז כולל את ערי השרון (הוד השרון, כפר סבא, רעננה, רמת השרון), את פתח תקווה, ראש העין, נס ציונה, רחובות, ראשון לציון, מודיעין ויישובים כפריים רבים. הוועדה המחוזית מרכז היא אחת העמוסות בארץ, ולוחות הזמנים של תוכניות בה ארוכים בהתאם.'] },
        { h2: 'מה בודקים לפני עסקת קרקע במרכז', bullets: ['**מצב תכנוני מדויק** — איזו תוכנית חלה, מה מצבה (בהכנה, מופקדת, מאושרת), והאם החלקה כלולה בה.', '**בעלות ורישום** — נסח טאבו עדכני, מספר בעלים, הערות ושעבודים; בקרקע חקלאית פרטית לרוב יורשים רבים.', '**הפקעות והקצאות** — כמה מהשטח ילך לצורכי ציבור בתוכנית איחוד וחלוקה.', '**מיסוי והיטלים** — מס רכישה 6%, היטל השבחה במימוש, מס שבח במכירה.', '**אופק זמן** — מי שקונה קרקע "בתהליך" חייב להיות מוכן להמתנה ארוכה ולאי-ודאות.'] },
        { h2: 'מה אנחנו עושים במרכז הארץ', bullets: ['איתור קרקעות ומגרשים - לרבות נכסים שאינם מפורסמים.', 'שיווק קרקעות פרטיות עבור בעלים ויורשים, כולל איחוד בעלים לעסקה אחת.', 'ליווי רוכשים ומשקיעים בבדיקת נאותות תכנונית ומשפטית.', 'ייזום, ניהול ופיקוח על פרויקטים למגורים.'] },
      ],
      faq: [
        { q: 'איפה כדאי לחפש קרקע במרכז הארץ?', a: 'בגבולות השטח הבנוי של ערים עם תוכניות מתאר כוללניות מאושרות ותוכניות ותמ"ל בקידום. אבל "כדאי" תלוי במחיר: קרקע במיקום מצוין במחיר שמניח הפשרה ודאית אינה בהכרח עסקה טובה. בודקים מסמכים, לא סיפורים.' },
        { q: 'האם אתם פועלים מחוץ לשרון?', a: 'כן. המיקוד שלנו הוא השרון ומחוז המרכז, ואנחנו מלווים גם עסקאות ופרויקטים באזורים אחרים לפי העניין.' },
      ],
    },
    en: {
      h1: 'Land and real estate in Central Israel — sourcing, marketing and development', cardTitle: 'Central Israel', placeName: 'Central District',
      metaTitle: 'Land, Plots and Real Estate in Central Israel: Sourcing, Marketing & Development | Afik Hanahal',
      description: 'Sourcing and marketing land and plots in Central Israel, supporting private landowners and developing projects: from the Sharon through Gush Dan to the Shephelah. What characterises the Central District land market and what to check before a deal.',
      summary: 'Central Israel has the country\'s highest housing demand and the scarcest land supply, which makes it the main arena for Vatmal plans, rezoning and urban renewal. Afik Hanahal, based in Hod Hasharon, operates in the Sharon and the Central District: sourcing and marketing private land and plots, supporting landowners, developing and managing projects.',
      sections: [
        { h2: 'What characterises the Central land market', paras: ['Three forces meet in Central Israel: high, steady demand, little vacant land, and government policy promoting large housing plans (Vatmal, umbrella agreements with municipalities) on agricultural land at city edges. The result is a market in which private agricultural land at the built-up boundary attracts much attention, and sometimes prices that assume a rezoning that has not yet happened.', 'The Central District includes the Sharon cities (Hod Hasharon, Kfar Saba, Ra\'anana, Ramat Hasharon), Petah Tikva, Rosh HaAyin, Ness Ziona, Rehovot, Rishon LeZion, Modi\'in and many rural communities. The Central District committee is one of the busiest in the country, and plan timelines are correspondingly long.'] },
        { h2: 'What to check before a land deal in Central Israel', bullets: ['**Exact planning status** — which plan applies, its status (in preparation, deposited, approved), and whether the parcel is included.', '**Ownership and registration** — a current Tabu extract, number of owners, notes and liens; private agricultural land usually has many heirs.', '**Expropriations and allocations** — how much of the area goes to public needs in the reparcelation plan.', '**Taxes and levies** — 6% purchase tax, betterment levy on realisation, capital gains tax on sale.', '**Time horizon** — whoever buys land "in process" must be ready for a long wait and uncertainty.'] },
        { h2: 'What we do in Central Israel', bullets: ['Sourcing land and plots - including unlisted properties.', 'Marketing private land for owners and heirs, including uniting owners into one deal.', 'Supporting buyers and investors through planning and legal due diligence.', 'Developing, managing and supervising residential projects.'] },
      ],
      faq: [
        { q: 'Where should I look for land in Central Israel?', a: 'At the built-up boundaries of cities with approved comprehensive outline plans and Vatmal plans in progress. But "should" depends on price: land in an excellent location at a price assuming certain rezoning is not necessarily a good deal. Check documents, not stories.' },
        { q: 'Do you operate outside the Sharon?', a: 'Yes. Our focus is the Sharon and the Central District, and we also support deals and projects in other areas case by case.' },
      ],
    },
  },
]
