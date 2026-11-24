import { adminToken } from '../adminAuth.js'
// The Lead Center's campaign names (lib/campaign-groups.js) for every open screen: read once (and again when the window comes
// back after a minute — another device may have merged something), painted at once from this session's copy, changed
// optimistically through POST /api/meta/campaign-names { ops } and put back on a failure.
import { useSyncExternalStore } from 'react'
import { cleanCampaignCfg, applyCampaignOps } from '../../lib/campaign-groups.js'

const AUTH = { get Authorization() { return `Bearer ${adminToken()}` } }
const KEY = 'afik_lc_campaigns_v1'
let cfg = (() => { try { return cleanCampaignCfg(JSON.parse(sessionStorage.getItem(KEY) || 'null')) } catch { return cleanCampaignCfg(null) } })()
const subs = new Set()
let started = false, lastLoad = 0, chain = Promise.resolve()

function set(next) {
  cfg = next
  try { sessionStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* private mode */ }
  for (const f of [...subs]) { try { f() } catch { /* never stop the others */ } }
}

async function load() {
  try {
    const r = await fetch('/api/meta/campaign-names', { headers: AUTH, cache: 'no-store', signal: AbortSignal.timeout(12000) })
    const d = r.ok ? await r.json() : null
    if (d?.cfg) { lastLoad = Date.now(); set(cleanCampaignCfg(d.cfg)) }
  } catch { /* the next focus tries again */ }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  load()
  window.addEventListener('focus', () => { if (Date.now() - lastLoad > 60e3) load() })
}

const subscribe = f => { subs.add(f); start(); return () => subs.delete(f) }
export function useCampaignCfg() { return useSyncExternalStore(subscribe, () => cfg, () => cfg) }
export const campaignCfgNow = () => cfg

/** Apply ops at once and save them (in order, one request at a time); a refusal puts the server's state back and throws */
export function campaignOps(ops) {
  const before = cfg
  set(applyCampaignOps(cfg, ops))
  const run = chain.then(async () => {
    const r = await fetch('/api/meta/campaign-names', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }), signal: AbortSignal.timeout(15000) })
    const d = await r.json().catch(() => null)
    if (!r.ok || !d?.cfg) throw new Error(d?.error || `HTTP ${r.status}`)
    lastLoad = Date.now()
    set(cleanCampaignCfg(d.cfg))
  })
  chain = run.catch(() => {})
  return run.catch(e => { set(before); load(); throw e })
}
