// Interactive tools rendered as static HTML + vanilla JS (no framework). Each `tool(lang)` returns markup.
// Purchase-tax brackets mirror src/RealEstateCalc.jsx (2026, updated every 16 January) - keep both in sync.
const U = '2026-09-16'

export const PURCHASE_TAX_2026 = {
  single: [[2_058_000, 0], [2_441_000, 0.035], [6_297_000, 0.05], [20_991_000, 0.08], [Infinity, 0.10]],
  additional: [[6_108_000, 0.08], [Infinity, 0.10]],
  land: 0.06,
}

const fmt = n => n.toLocaleString('en-US')

function purchaseTaxTool(lang) {
  const en = lang === 'en'
  const L = en ? {
    price: 'Purchase price (NIS)', kind: 'What are you buying?', single: 'Single (only) residential home', additional: 'Additional home / investor', land: 'Land, plot, commercial or agricultural (6%)',
    calc: 'Calculate', result: 'Estimated purchase tax', effective: 'effective rate', breakdown: 'Bracket breakdown', bracket: 'Bracket', rate: 'Rate', tax: 'Tax',
    note: 'Estimate only, based on the 2026 brackets (updated every 16 January). Reliefs for new immigrants, disabled buyers and home-upgraders are not included. Verify with a lawyer or tax adviser before signing.',
    landNote: 'On residential building land, a 1% refund may be available if a building permit for a dwelling is issued within 24 months.',
  } : {
    price: 'מחיר הרכישה (₪)', kind: 'מה רוכשים?', single: 'דירת מגורים יחידה', additional: 'דירה נוספת / משקיע', land: 'קרקע, מגרש, נכס מסחרי או חקלאי (6%)',
    calc: 'חשבו', result: 'מס רכישה משוער', effective: 'שיעור אפקטיבי', breakdown: 'פירוט לפי מדרגות', bracket: 'מדרגה', rate: 'שיעור', tax: 'מס',
    note: 'הערכה בלבד לפי מדרגות 2026 (מתעדכנות מדי 16 בינואר). הקלות לעולים, לנכים ולמשפרי דיור אינן כלולות. יש לאמת עם עורך דין או יועץ מס לפני חתימה.',
    landNote: 'בקרקע לבנייה למגורים ייתכן החזר של 1% אם יתקבל היתר בנייה לדירה בתוך 24 חודשים.',
  }
  const B = JSON.stringify({ single: PURCHASE_TAX_2026.single.map(([t, r]) => [t === Infinity ? null : t, r]), additional: PURCHASE_TAX_2026.additional.map(([t, r]) => [t === Infinity ? null : t, r]), land: PURCHASE_TAX_2026.land })
  return `
<div class="tool" id="ptx">
  <div class="field"><label for="ptx-price">${L.price}</label><input id="ptx-price" type="text" inputmode="numeric" placeholder="3,000,000" autocomplete="off"></div>
  <fieldset class="field"><legend>${L.kind}</legend>
    <label class="radio"><input type="radio" name="ptx-kind" value="single" checked> ${L.single}</label>
    <label class="radio"><input type="radio" name="ptx-kind" value="additional"> ${L.additional}</label>
    <label class="radio"><input type="radio" name="ptx-kind" value="land"> ${L.land}</label>
  </fieldset>
  <button type="button" class="btn" id="ptx-go">${L.calc}</button>
  <div class="tool-result" id="ptx-out" hidden aria-live="polite">
    <div class="big"><span>${L.result}</span><b id="ptx-total"></b><small id="ptx-eff"></small></div>
    <table id="ptx-table"><caption>${L.breakdown}</caption><thead><tr><th>${L.bracket}</th><th>${L.rate}</th><th>${L.tax}</th></tr></thead><tbody></tbody></table>
    <p class="note" id="ptx-land" hidden>${L.landNote}</p>
  </div>
  <p class="note">${L.note}</p>
</div>
<script>(function(){
var B=${B},$=function(s){return document.querySelector(s)};
var price=$('#ptx-price'),out=$('#ptx-out'),tot=$('#ptx-total'),eff=$('#ptx-eff'),tb=$('#ptx-table tbody'),landNote=$('#ptx-land');
function fmt(n){return Math.round(n).toLocaleString('en-US')}
function pct(r){return (r*100).toFixed(1).replace(/\\.0$/,'')+'%'}
price.addEventListener('input',function(){var v=price.value.replace(/[^0-9]/g,'');price.value=v?Number(v).toLocaleString('en-US'):''});
function run(){
  var p=Number(price.value.replace(/[^0-9]/g,''))||0,kind=document.querySelector('input[name=ptx-kind]:checked').value,rows=[],total=0;
  if(!p){out.hidden=true;return}
  if(kind==='land'){total=p*B.land;rows.push(['0 – '+fmt(p),pct(B.land),fmt(total)])}
  else{var prev=0;B[kind].forEach(function(b){var top=b[0]==null?Infinity:b[0];if(p<=prev)return;var slice=Math.min(p,top)-prev,t=slice*b[1];total+=t;rows.push([fmt(prev)+' – '+(top===Infinity?'∞':fmt(top)),pct(b[1]),fmt(t)]);prev=top})}
  tot.textContent='₪ '+fmt(total);eff.textContent='${L.effective}: '+(p?(total/p*100).toFixed(2):'0')+'%';
  tb.innerHTML=rows.map(function(r){return '<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td>₪ '+r[2]+'</td></tr>'}).join('');
  landNote.hidden=kind!=='land';out.hidden=false;
  if(window.gtag)gtag('event','tool_use',{tool:'purchase_tax',kind:kind,page_lang:'${lang}'});
}
$('#ptx-go').addEventListener('click',run);price.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();run()}});
document.querySelectorAll('input[name=ptx-kind]').forEach(function(r){r.addEventListener('change',function(){if(!out.hidden)run()})});
})();</script>`
}

function sellerNetTool(lang) {
  const en = lang === 'en'
  const L = en ? {
    price: 'Expected sale price (NIS)', fee: 'Brokerage fee (%)', vat: 'VAT on brokerage (%)', lawyer: 'Lawyer fee (NIS, incl. VAT)', levy: 'Betterment levy (NIS, if any)', tax: 'Capital gains tax estimate (NIS, if any)', other: 'Other costs (NIS)',
    calc: 'Calculate', result: 'Estimated net proceeds', costs: 'Total costs', line: 'Item', amount: 'Amount', brokerage: 'Brokerage fee incl. VAT',
    note: 'A planning aid, not tax advice. The betterment levy and capital gains tax depend on the property\'s history and planning status; enter figures from your appraiser or lawyer. Customary brokerage in Israel is about 2% + VAT.',
  } : {
    price: 'מחיר מכירה צפוי (₪)', fee: 'דמי תיווך (%)', vat: 'מע"מ על דמי התיווך (%)', lawyer: 'שכר טרחת עו"ד (₪, כולל מע"מ)', levy: 'היטל השבחה (₪, אם חל)', tax: 'הערכת מס שבח (₪, אם חל)', other: 'עלויות נוספות (₪)',
    calc: 'חשבו', result: 'תקבול נטו משוער', costs: 'סך העלויות', line: 'סעיף', amount: 'סכום', brokerage: 'דמי תיווך כולל מע"מ',
    note: 'כלי עזר לתכנון, לא ייעוץ מס. היטל השבחה ומס שבח תלויים בהיסטוריה של הנכס ובמצבו התכנוני; הזינו סכומים מהשמאי או מעורך הדין שלכם. דמי תיווך מקובלים בישראל הם כ-2% + מע"מ.',
  }
  const f = (id, label, ph, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="text" inputmode="decimal" placeholder="${ph}" autocomplete="off"${extra}></div>`
  return `
<div class="tool" id="net">
  ${f('net-price', L.price, '4,500,000')}
  <div class="row2">${f('net-fee', L.fee, '2', ' value="2"')}${f('net-vat', L.vat, '18', ' value="18"')}</div>
  ${f('net-lawyer', L.lawyer, '25,000')}
  ${f('net-levy', L.levy, '0')}
  ${f('net-tax', L.tax, '0')}
  ${f('net-other', L.other, '0')}
  <button type="button" class="btn" id="net-go">${L.calc}</button>
  <div class="tool-result" id="net-out" hidden aria-live="polite">
    <div class="big"><span>${L.result}</span><b id="net-total"></b><small id="net-costs"></small></div>
    <table><thead><tr><th>${L.line}</th><th>${L.amount}</th></tr></thead><tbody id="net-rows"></tbody></table>
  </div>
  <p class="note">${L.note}</p>
</div>
<script>(function(){
var $=function(s){return document.querySelector(s)},N=function(id){return Number(($(id).value||'').replace(/[^0-9.]/g,''))||0};
function fmt(n){return Math.round(n).toLocaleString('en-US')}
['#net-price','#net-lawyer','#net-levy','#net-tax','#net-other'].forEach(function(id){var el=$(id);el.addEventListener('input',function(){var v=el.value.replace(/[^0-9]/g,'');el.value=v?Number(v).toLocaleString('en-US'):''})});
function run(){
  var p=N('#net-price');if(!p){$('#net-out').hidden=true;return}
  var brok=p*N('#net-fee')/100*(1+N('#net-vat')/100),rows=[['${L.brokerage}',brok],['${L.lawyer}',N('#net-lawyer')],['${L.levy}',N('#net-levy')],['${L.tax}',N('#net-tax')],['${L.other}',N('#net-other')]];
  var costs=rows.reduce(function(a,r){return a+r[1]},0);
  $('#net-total').textContent='₪ '+fmt(p-costs);$('#net-costs').textContent='${L.costs}: ₪ '+fmt(costs);
  $('#net-rows').innerHTML=rows.map(function(r){return '<tr><td>'+r[0]+'</td><td>₪ '+fmt(r[1])+'</td></tr>'}).join('');
  $('#net-out').hidden=false;if(window.gtag)gtag('event','tool_use',{tool:'seller_net',page_lang:'${lang}'});
}
$('#net-go').addEventListener('click',run);
})();</script>`
}

export const TOOLS = [
  {
    slug: 'purchase-tax-calculator', cta: 'buy', updated: U, tool: purchaseTaxTool,
    related: { services: ['land-investment', 'land-brokerage'], guides: ['land-due-diligence-checklist', 'agricultural-land-investment'], glossary: ['purchase-tax', 'capital-gains-tax', 'betterment-levy'], tools: ['seller-net-proceeds-calculator'] },
    he: {
      h1: 'מחשבון מס רכישה 2026', cardTitle: 'מחשבון מס רכישה 2026',
      metaTitle: 'מחשבון מס רכישה 2026: דירה יחידה, דירה נוספת וקרקע | אפיק הנחל',
      description: 'מחשבון מס רכישה מעודכן ל-2026: דירה יחידה, דירה נוספת/משקיע וקרקע או מגרש (6%). פירוט לפי מדרגות ושיעור אפקטיבי, ללא הרשמה.',
      summary: 'הזינו מחיר רכישה ובחרו סוג נכס - המחשבון מציג את מס הרכישה המשוער לפי מדרגות 2026, עם פירוט לפי מדרגות. לקרקע ומגרשים חל שיעור אחיד של 6%. למחשבון המלא עם מס שבח ותשואה, ראו [מחשבון הנדל"ן באתר](/#calculator).',
      sections: [
        { h2: 'איך המחשבון עובד', paras: ['מס הרכישה בישראל הוא מס מדורג לדירת מגורים ומס אחיד לקרקע. המחשבון מיישם את מדרגות 2026 שפורסמו על ידי רשות המסים (המדרגות מתעדכנות מדי 16 בינואר) ומציג את החלוקה לפי מדרגות כדי שתוכלו להבין מאיפה המספר מגיע.'] },
        { h2: 'מדרגות 2026', table: { head: ['סוג', 'עד (₪)', 'שיעור'], rows: [
          ['דירה יחידה', '2,058,000', '0%'], ['דירה יחידה', '2,441,000', '3.5%'], ['דירה יחידה', '6,297,000', '5%'], ['דירה יחידה', '20,991,000', '8%'], ['דירה יחידה', 'מעל', '10%'],
          ['דירה נוספת', '6,108,000', '8%'], ['דירה נוספת', 'מעל', '10%'], ['קרקע / מגרש / מסחרי', 'כל סכום', '6%'],
        ] } },
        { h2: 'מה המחשבון לא כולל', bullets: ['הקלות לעולים חדשים, לנכים ולנפגעי פעולות איבה.', 'הסדר "משפר דיור" (מכירת הדירה הקודמת בתוך התקופה שבחוק) - במקרה זה מחשבים כדירה יחידה.', 'החזר 1% בקרקע לבנייה שבה התקבל היתר תוך 24 חודשים.', 'עסקאות מיוחדות: מתנה בין קרובים, ירושה, פירוק שיתוף, קבוצות רכישה.'] },
      ],
      faq: [
        { q: 'כמה מס רכישה משלמים על מגרש לבניית בית?', a: '6% ממחיר הרכישה. אם יתקבל היתר בנייה לדירת מגורים אחת לפחות בתוך 24 חודשים, ניתן לבקש החזר של 1% (כלומר מס אפקטיבי של 5%).' },
        { q: 'האם מס הרכישה על דירה שנייה תמיד 8%?', a: 'עד 6,108,000 ₪ (2026) - 8%, ומעל - 10%. אם מוכרים את הדירה הקודמת בתוך התקופה הקבועה בחוק, ניתן לשלם לפי מדרגות דירה יחידה.' },
        { q: 'מתי משלמים מס רכישה?', a: 'תוך 30 יום ממועד העסקה (חתימת החוזה או זיכרון הדברים) מגישים הצהרה ומשלמים. איחור גורר ריבית והצמדה.' },
      ],
    },
    en: {
      h1: 'Purchase tax calculator 2026', cardTitle: 'Purchase tax calculator 2026',
      metaTitle: 'Israel Purchase Tax Calculator 2026: single home, additional home and land | Afik Hanahal',
      description: 'Purchase tax calculator updated for 2026: single home, additional home/investor and land or plot (6%). Bracket breakdown and effective rate, no sign-up.',
      summary: 'Enter a purchase price and choose the property type - the calculator shows the estimated purchase tax under the 2026 brackets, with a bracket breakdown. Land and plots are taxed at a flat 6%. For the full calculator with capital gains and yield, see the [real estate calculator on the site](/#calculator).',
      sections: [
        { h2: 'How the calculator works', paras: ['Purchase tax in Israel is progressive for residential homes and flat for land. The calculator applies the 2026 brackets published by the Tax Authority (updated every 16 January) and shows the split by bracket so you can see where the number comes from.'] },
        { h2: '2026 brackets', table: { head: ['Type', 'Up to (NIS)', 'Rate'], rows: [
          ['Single home', '2,058,000', '0%'], ['Single home', '2,441,000', '3.5%'], ['Single home', '6,297,000', '5%'], ['Single home', '20,991,000', '8%'], ['Single home', 'above', '10%'],
          ['Additional home', '6,108,000', '8%'], ['Additional home', 'above', '10%'], ['Land / plot / commercial', 'any amount', '6%'],
        ] } },
        { h2: 'What the calculator does not include', bullets: ['Reliefs for new immigrants, people with disabilities and victims of hostilities.', 'The "home-upgrader" arrangement (selling the previous home within the statutory period) - in that case calculate as a single home.', 'The 1% refund on building land where a permit is issued within 24 months.', 'Special transactions: gifts between relatives, inheritance, dissolution of co-ownership, purchase groups.'] },
      ],
      faq: [
        { q: 'How much purchase tax on a plot for a house?', a: '6% of the purchase price. If a building permit for at least one dwelling is issued within 24 months, a 1% refund can be requested (an effective 5%).' },
        { q: 'Is purchase tax on a second home always 8%?', a: 'Up to NIS 6,108,000 (2026) - 8%, above that - 10%. If the previous home is sold within the statutory period, single-home brackets may apply.' },
        { q: 'When is purchase tax paid?', a: 'Within 30 days of the transaction date (contract or memorandum) a declaration is filed and the tax paid. Late payment carries interest and indexation.' },
      ],
    },
  },
  {
    slug: 'seller-net-proceeds-calculator', cta: 'sell', updated: U, tool: sellerNetTool,
    related: { services: ['sell-your-property', 'land-brokerage'], guides: ['how-to-sell-property', 'property-valuation'], glossary: ['brokerage-fee', 'betterment-levy', 'capital-gains-tax', 'appraiser'], tools: ['purchase-tax-calculator'] },
    he: {
      h1: 'מחשבון נטו למוכר: כמה יישאר לכם מהמכירה', cardTitle: 'מחשבון נטו למוכר',
      metaTitle: 'מחשבון נטו למוכר נכס: דמי תיווך, עו"ד, היטל השבחה ומס שבח | אפיק הנחל',
      description: 'חשבו כמה יישאר לכם ממכירת דירה, בית או מגרש אחרי דמי תיווך ומע"מ, שכר טרחת עו"ד, היטל השבחה, מס שבח ועלויות נוספות.',
      summary: 'הזינו מחיר מכירה צפוי ואת העלויות הידועות לכם - המחשבון מציג את סך העלויות ואת התקבול נטו. שני הסעיפים הגדולים, היטל השבחה ומס שבח, תלויים בנכס ובהיסטוריה שלו: קבלו אותם משמאי או מעורך דין והזינו כאן.',
      sections: [
        { h2: 'העלויות שמוכר צריך להכיר', bullets: ['**דמי תיווך** - נהוג כ-2% + מע"מ, בהתאם להסכם ההזמנה.', '**שכר טרחת עורך דין** - לרוב 0.5%-1% + מע"מ או סכום קבוע.', '**היטל השבחה** - 50% מעליית השווי שנבעה מתוכנית; רלוונטי במיוחד למגרשים ולבתים פרטיים.', '**מס שבח** - 25% על השבח הריאלי, אלא אם חל פטור דירת מגורים יחידה.', '**אישורי עירייה וטאבו** - חובות ארנונה, מים, אגרות רישום.', '**תיקונים והכנה למכירה** - צביעה, תיקונים, צילום מקצועי.'] },
        { h2: 'איך להשתמש בתוצאה', paras: ['התקבול נטו הוא המספר שכדאי לתכנן לפיו - למשל לרכישת הנכס הבא או להשקעה. אם התוצאה נמוכה מהצפוי, בדקו אם חל פטור ממס שבח, אם ניתן להפחית את היטל ההשבחה בשומה נגדית, ואם ניתן לנכות הוצאות מוכרות מהשבח.'] },
      ],
      faq: [
        { q: 'האם דמי התיווך כוללים מע"מ?', a: 'בדרך כלל דמי התיווך נקובים ללא מע"מ, והמע"מ מתווסף. בדקו בטופס ההזמנה.' },
        { q: 'מי משלם היטל השבחה במכירה?', a: 'לפי החוק - הבעלים בעת אישור התוכנית, כלומר לרוב המוכר. ניתן להסכים אחרת בחוזה.' },
      ],
    },
    en: {
      h1: 'Seller net proceeds calculator: what you keep after the sale', cardTitle: 'Seller net proceeds calculator',
      metaTitle: 'Seller Net Proceeds Calculator: brokerage, legal, betterment levy and capital gains | Afik Hanahal',
      description: 'Calculate what remains from selling an apartment, house or plot after brokerage and VAT, legal fees, betterment levy, capital gains tax and other costs.',
      summary: 'Enter the expected sale price and the costs you know - the calculator shows total costs and net proceeds. The two big items, betterment levy and capital gains tax, depend on the property and its history: get them from an appraiser or lawyer and enter them here.',
      sections: [
        { h2: 'The costs a seller should know', bullets: ['**Brokerage fee** - customarily about 2% + VAT, per the brokerage order.', '**Legal fee** - usually 0.5%-1% + VAT or a fixed sum.', '**Betterment levy** - 50% of the plan-driven value increase; especially relevant to plots and detached houses.', '**Capital gains tax** - 25% on the real gain, unless the single-residence exemption applies.', '**Municipal and Tabu certificates** - property tax and water debts, registration fees.', '**Repairs and preparation** - painting, fixes, professional photography.'] },
        { h2: 'How to use the result', paras: ['Net proceeds is the number to plan around - for the next purchase or an investment. If the result is lower than expected, check whether a capital gains exemption applies, whether the betterment levy can be reduced by a counter-appraisal, and whether recognised expenses can be deducted from the gain.'] },
      ],
      faq: [
        { q: 'Does the brokerage fee include VAT?', a: 'Usually the fee is quoted before VAT, which is added. Check the brokerage order form.' },
        { q: 'Who pays the betterment levy on a sale?', a: 'By law - the owner at the time the plan was approved, i.e. usually the seller. The parties may agree otherwise in the contract.' },
      ],
    },
  },
]
