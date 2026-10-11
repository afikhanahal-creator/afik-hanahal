// Every Meta Lead Ads lead also lives in the CRM (the `contacts` table = admin "לידים", the bulk-send audience),
// so nobody who left details is visible only in the Lead Center. `meta_leads` stays the Meta-side record
// (form answers, the Lead Center conversation); the contact row points back to it through crm_data.metaLeadId.
// The welcome belongs to the Meta pipeline (welcomeExternalLead), so the row is marked "welcome handled" and the
// CRM's own welcome rule never sends a second one. A lead copied in after the fact (backfill) is also marked as
// past the no-reply follow-ups, so old leads don't flood the approval queue.
import { metaFormAnswers, answersToText } from '../src/lib/leadFields.js'

export const isTestMetaLead = l => /<test lead|dummy data for/i.test(`${l?.name || ''} ${l?.email || ''}`)

// 972501234567 → 0501234567 (the way website leads store it); anything else unchanged
export const localPhone = p => {
  const d = String(p || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('972') ? '0' + d.slice(3) : d
}

const NO_REPLY_KEYS = Array.from({ length: 10 }, (_, i) => `noreply:${i + 1}`)

/**
 * meta_leads row → contacts row (pure).
 * opts.welcome: 'sent' (the welcome went out) · 'handled' (the Meta pipeline owns it: skipped in the CRM)
 * opts.quiet: true for a lead copied in after the fact — no follow-ups are proposed for it
 */
export function contactFromMetaLead(ml, { welcome = 'handled', welcomeAt = null, quiet = false, now = new Date().toISOString() } = {}) {
  const answers = metaFormAnswers(ml.raw_fields)
  const campaign = ml.campaign_name || ''
  const form = ml.form_name || ''
  // Lead Center status → CRM stage (new · contacted · discovery = a call is set · won)
  const leadStatus = { contacted: 'contacted', scheduled: 'discovery', closed: 'won', saved_to_crm: 'new' }[ml.status] || 'new'
  const metaLeadId = String(ml.id)
  const skipped = {}
  if (welcome !== 'sent') skipped.welcome = now
  if (quiet) for (const k of NO_REPLY_KEYS) skipped[k] = now
  const auto = { ...(welcome === 'sent' ? { sent: { welcome: welcomeAt || now } } : {}), ...(Object.keys(skipped).length ? { skipped } : {}) }
  return {
    name: ml.name || '',
    phone: localPhone(ml.phone),
    email: ml.email || null,
    message: [ml.notes || '', answersToText(answers)].filter(Boolean).join('\n') || null,
    prop_title: campaign || form || 'Meta',
    prop_location: null,
    source: 'meta',
    created_at: ml.created_at || now,
    lead_status: leadStatus,
    crm_data: {
      leadStatus,
      metaLeadId,
      leadgenId: ml.leadgen_id || null,
      campaignName: campaign,
      formName: form,
      formAnswers: answers,
      ...(ml.call_time ? { callTime: ml.call_time } : {}),
      origin: { channel: 'meta', lang: 'he', campaign, form, metaLeadId },
      auto,
    },
  }
}

// The contact row of a Meta lead, if it was copied already
export async function findMirror(client, metaLeadId) {
  const { data } = await client.from('contacts').select('id').eq('crm_data->>metaLeadId', String(metaLeadId)).limit(1)
  return data?.[0] || null
}

/** Copy one Meta lead into contacts (idempotent: a lead already copied is returned as is) → { id, created } | { skipped } */
export async function mirrorMetaLead(client, ml, opts = {}) {
  if (!ml?.id) return { skipped: 'no id' }
  if (isTestMetaLead(ml)) return { skipped: 'test lead' }
  if (ml.deleted_at) return { skipped: 'archived' }
  if (!ml.phone && !ml.email) return { skipped: 'no contact details' }
  const have = opts.known ? null : await findMirror(client, ml.id)
  if (have) return { id: have.id, created: false }
  const { data, error } = await client.from('contacts').insert(contactFromMetaLead(ml, opts)).select('id').single()
  if (error) throw new Error(`contacts insert: ${error.message}`)
  return { id: data.id, created: true }
}

/** Copy every Meta lead that isn't in the CRM yet, quietly (no messages, no follow-ups) → { created, existing, skipped, errors, more? }
 *  budgetMs keeps one call inside the function's time limit; `more: true` = call again for the rest */
export async function backfillMetaLeads(client, { limit = 1000, budgetMs = 40000 } = {}) {
  const started = Date.now()
  const out = { created: 0, existing: 0, skipped: 0, errors: [] }
  const { data: rows, error } = await client.from('meta_leads')
    .select('id,leadgen_id,name,email,phone,campaign_name,form_name,raw_fields,status,notes,call_time,wa_sent,created_at,deleted_at')
    .is('deleted_at', null).order('created_at', { ascending: true }).limit(limit)
  if (error) throw new Error(`meta_leads read: ${error.message}`)
  const { data: mirrored } = await client.from('contacts').select('crm_data->>metaLeadId').eq('source', 'meta').limit(5000)
  const have = new Set((mirrored || []).map(r => String(r.metaLeadId)))
  for (const ml of rows || []) {
    if (have.has(String(ml.id))) { out.existing++; continue }
    if (Date.now() - started > budgetMs) { out.more = true; break }
    try {
      const r = await mirrorMetaLead(client, ml, { welcome: ml.wa_sent ? 'sent' : 'handled', welcomeAt: ml.created_at, quiet: true, known: true })
      if (r.created) out.created++; else if (r.id) out.existing++; else out.skipped++
    } catch (e) { out.errors.push(`${ml.id}: ${e.message}`.slice(0, 200)) }
  }
  return out
}
