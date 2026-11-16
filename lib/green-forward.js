// The office line has ONE webhook address at Green API and two systems that listen to it: this CRM (handleGreenHook) and
// Kurkoos Finance, which takes in photos / PDFs of receipts sent from registered phones. The webhook stays pointed here
// (greenSettingsCheck re-asserts it) and every photo or document delivery is passed on, unchanged, to the finance system.
//   KURKOOS_FINANCE_HOOK_URL   — https://www.kurkoos-group.co.il/api/finance-whatsapp (https only)
//   KURKOOS_FINANCE_HOOK_TOKEN — sent as `Authorization: Bearer …`, never in the address
// Nothing happens while either is missing. The promise never rejects: a failed forward must not touch the storing of the
// message nor the answer to Green.

export function forwardTarget(env = process.env) {
  const raw = String(env.KURKOOS_FINANCE_HOOK_URL || '').trim()
  const token = String(env.KURKOOS_FINANCE_HOOK_TOKEN || '').trim()
  if (!raw || !token) return null
  let u
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return { url: u.toString(), token }
}

// Only what the finance system reads: a photo or a document, received on the line or sent from the office phone. Text,
// statuses, calls and everything else stay here: other clients' messages to the office are none of the finance system's
// business (2026-11-16, the office). The body is still passed on byte for byte.
const FILE_TYPES = ['imageMessage', 'documentMessage']
const DELIVERIES = ['incomingMessageReceived', 'outgoingMessageReceived']
export function isFinanceFile(rawBody) {
  let b
  try { b = JSON.parse(rawBody) } catch { return false }
  return !!b && DELIVERIES.includes(b.typeWebhook) && FILE_TYPES.includes(b.messageData?.typeMessage)
}

// rawBody: the JSON text exactly as Green sent it. Resolves to { ok, skipped?, status?, error? }.
export async function forwardGreenHook(rawBody, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 8000, log = console.error } = {}) {
  const target = forwardTarget(env)
  const body = typeof rawBody === 'string' ? rawBody : ''
  if (!target || !body) return { ok: false, skipped: true }
  if (!isFinanceFile(body)) return { ok: false, skipped: 'not_a_file' }
  try {
    const r = await fetchImpl(target.url, {
      method: 'POST',
      // X-Kurkoos-Relay: the finance system never passes a relayed delivery back here (that would loop)
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.token}`, 'X-Kurkoos-Relay': 'afik' },
      body,
      redirect: 'error',                      // the bearer token never follows a redirect to another host
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!r.ok) { log('[green-hook] forward', `HTTP ${r.status}`); return { ok: false, status: r.status } }
    return { ok: true, status: r.status }
  } catch (e) {
    const error = String(e?.name === 'TimeoutError' ? 'timeout' : e?.message || e).split(target.token).join('***')
    try { log('[green-hook] forward', error) } catch {}
    return { ok: false, error }
  }
}
