// One timeline per contact for the Lead Center: every inquiry from the same phone (Meta forms with their answers, the
// website / booking forms of the CRM copy), booked calls, stage changes, notes and automatic WhatsApp sends —
// newest first. Pure; tested in leadHistory.test.mjs. The admin's CRM leads carry crm_data spread on the lead itself.
import { metaFormAnswers, shortCampaign, sourceLabel } from './leadFields.js'

const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)
const time = v => (typeof v === 'number' ? v : Date.parse(v || ''))
const fmt = (iso, lang) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** The CRM lead that belongs to a Meta lead: its copy (metaLeadId), else the same phone */
export function crmLeadFor(metaLead, crmLeads = []) {
  if (!metaLead) return null
  const id = String(metaLead.id)
  const byId = crmLeads.find(l => String(l?.metaLeadId ?? l?.crm_data?.metaLeadId ?? '') === id)
  if (byId) return byId
  const k = tail9(metaLead.phone)
  return k.length === 9 ? crmLeads.find(l => tail9(l?.phone) === k) || null : null
}

/** → [{ at, kind: 'inquiry' | 'booking' | 'stage' | 'note' | 'auto', title, lines?, current?, cancelled? }] newest first */
export function leadHistory({ lead, metaLeads = [], crmLead = null, stageName = s => s, lang = 'he' } = {}) {
  if (!lead) return []
  const he = lang !== 'en'
  const items = []
  const k = tail9(lead.phone)
  const same = k.length === 9 ? metaLeads.filter(m => tail9(m.phone) === k) : []
  if (!same.some(m => m.id === lead.id)) same.push(lead)
  for (const m of same) {
    const camp = m.campaign_name ? shortCampaign(m.campaign_name) || m.campaign_name : ''
    items.push({
      at: time(m.created_at), kind: 'inquiry', current: m.id === lead.id,
      title: he ? `השאירו פרטים במודעה${camp ? ` · ${camp}` : ''}` : `Left their details on an ad${camp ? ` · ${camp}` : ''}`,
      lines: metaFormAnswers(m.raw_fields, lang).map(x => `${x.q}: ${x.a}`),
    })
  }
  const c = crmLead
  if (c) {
    const get = key => c[key] ?? c.crm_data?.[key]
    if (c.source && c.source !== 'meta') {
      const answers = (get('formAnswers') || []).filter(x => x && x.q && x.a && !x.booking).map(x => `${x.q}: ${x.a}`)
      items.push({
        at: time(c.ts ?? c.created_at), kind: 'inquiry',
        title: he ? `פנייה · ${sourceLabel(c.source, 'he')}` : `Inquiry · ${sourceLabel(c.source, 'en')}`,
        lines: [c.msg || c.message, c.propTitle || c.prop_title, ...answers].filter(Boolean).map(x => String(x).slice(0, 300)),
      })
    }
    for (const b of get('bookings') || []) {
      if (!b?.start) continue
      items.push({ at: time(b.at ?? b.start), kind: 'booking', cancelled: !!b.cancelled, title: he ? `נקבעה שיחה ל${fmt(b.start, 'he')}${b.cancelled ? ' (בוטלה)' : ''}` : `Call booked for ${fmt(b.start, 'en')}${b.cancelled ? ' (cancelled)' : ''}` })
    }
    for (const s of get('stageLog') || []) if (s?.to) items.push({ at: time(s.at), kind: 'stage', title: he ? `עבר לשלב: ${stageName(s.to)}` : `Moved to: ${stageName(s.to)}` })
    for (const n of get('notes') || []) if (n?.text) items.push({ at: time(n.ts), kind: 'note', title: String(n.text).slice(0, 400) })
    for (const [rule, at] of Object.entries(get('auto')?.sent || {})) items.push({ at: time(at), kind: 'auto', title: he ? `נשלחה הודעת וואטסאפ אוטומטית${rule === 'welcome' ? ' (פתיחה)' : ''}` : `Automatic WhatsApp sent${rule === 'welcome' ? ' (welcome)' : ''}` })
  }
  return items.filter(x => Number.isFinite(x.at)).sort((a, b) => b.at - a.at)
}
