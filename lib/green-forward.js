// The office line has ONE webhook address at Green API and two systems that listen to it: this CRM (handleGreenHook) and
// Kurkoos Finance, which takes in photos / PDFs of receipts sent from registered phones. The webhook stays pointed here
// (greenSettingsCheck re-asserts it) and every delivery is passed on, unchanged, to the finance system.
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

// rawBody: the JSON text exactly as Green sent it. Resolves to { ok, skipped?, status?, error? }.
export async function forwardGreenHook(rawBody, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 8000, log = console.error } = {}) {
  const target = forwardTarget(env)
  const body = typeof rawBody === 'string' ? rawBody : ''
  if (!target || !body) return { ok: false, skipped: true }
  try {
    const r = await fetchImpl(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.token}` },
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
