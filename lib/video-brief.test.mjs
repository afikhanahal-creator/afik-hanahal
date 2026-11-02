import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBrief, propertyFacts, projectSlug, setupCommands, formatShekel } from './video-brief.js'

const P = { id: 1761234567890, title: 'דירת 4 חדרים עם מרפסת', location: 'כפר סבא', neighborhood: 'הירוקה', category: 'apartments', price: '3,250,000', rooms: 4, size: 110, floor: '3', images: ['https://x.supabase.co/a.jpg', 'https://x.supabase.co/b.jpg', 'data:image/png;base64,AA'] }

test('facts come only from the record', () => {
  assert.deepEqual(propertyFacts(P), ['דירה', '4 חדרים', '110 מ״ר', 'קומה 3', 'מחיר ₪3,250,000'])
  assert.deepEqual(propertyFacts({ category: 'land', dunams: 2.5, gush: 6438, helka: 12 }), ['מגרש', '2.5 דונם', 'גוש 6438 חלקה 12'])
  assert.deepEqual(propertyFacts({ category: 'rentals', price: 7500 }), ['נכס להשכרה', 'מחיר ₪7,500 לחודש'])
  assert.deepEqual(propertyFacts({}), [])
  assert.equal(formatShekel('abc'), '')
})

test('one property brief', () => {
  const b = buildBrief([P], { format: 'reel', seconds: 30, voice: 'none', ai: 'real' })
  assert.match(b, /real-estate-afik\.md/)
  assert.match(b, /afik-hanahal/)
  assert.match(b, /api\/properties\?one=1761234567890/)
  assert.match(b, /9:16 \(1080×1920\), בערך 30 שניות/)
  assert.match(b, /2 תמונות באתר/) // data: URLs are not photos
  assert.match(b, /רק חומר אמיתי/)
  assert.match(b, /סטוריבורד/)
  assert.doesNotMatch(b, /batch-report/)
  assert.doesNotMatch(b, /\$\d/) // no budget given
})

test('batch brief, all formats, budget, footage, sold warning', () => {
  const b = buildBrief([P, { id: 'x"1', title: 'מגרש', status: 'נמכר' }], { format: 'all', budget: 12, footage: 'D:\\צילומים\\כפר סבא', lang: 'both', music: false })
  assert.match(b, /2 סרטוני נדל״ן/)
  assert.match(b, /^1\. דירת 4 חדרים/m)
  assert.match(b, /^2\. מגרש/m)
  assert.match(b, /batch-report\.md/)
  assert.match(b, /\$12 לכל הסדרה/)
  assert.doesNotMatch(b, /הנכס עוד לא מפורסם/)
  assert.match(b, /D:\\צילומים\\כפר סבא/)
  assert.match(b, /נמכר \/ הושכר/)
  assert.match(b, /בלי מוזיקה/)
  assert.match(b, /4:5/)
  assert.match(b, /16:9/)
  assert.match(b, /one=x%221/)
})

test('a hidden property lists its photos and description', () => {
  const b = buildBrief([{ ...P, published: false, description: 'שקט ומואר', images: undefined }], { budget: 3 })
  assert.match(b, /אין תמונות באתר/)
  const c = buildBrief([{ ...P, published: false, description: 'שקט ומואר' }], { budget: 3 })
  assert.match(c, /עוד לא מפורסם/)
  assert.match(c, /^   https:\/\/x\.supabase\.co\/a\.jpg$/m)
  assert.match(c, /תיאור: שקט ומואר/)
  assert.match(c, /\$3 לסרטון/)
})

test('no property, slug and setup commands', () => {
  assert.match(buildBrief([], {}), /עוד לא נבחר/)
  assert.equal(projectSlug({ id: '12/../3' }), 'afik-123')
  assert.equal(projectSlug({}), 'afik-property')
  const c = setupCommands('C:\\Video\\OM')
  assert.equal(c.open, 'cd "C:\\Video\\OM"; claude')
  assert.match(c.install, /-Root "C:\\Video\\OM"$/)
  assert.match(setupCommands('').backlot, /OpenMontage-main"; \.\\\.venv/)
})
