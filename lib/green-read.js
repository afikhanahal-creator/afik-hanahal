// Green API reads that several screens / people ask for at once (api/meta.js greenFetch): how long an answer is reused, and the
// key that tells two calls are the same read. Reads only — a send, a setting or a forward is never shared.
export const GREEN_READ_TTL = {
  getStateInstance: 15000, getWaSettings: 60000, getSettings: 30000, getContacts: 60000, getContactInfo: 60000,
  lastIncomingMessages: 10000, lastOutgoingMessages: 10000, getChatHistory: 3000, getChats: 30000,
}
/** Pure: a Green URL (+ its init) → { method, key } for a shared read, or null (not a read we share) */
export function greenReadKey(url, init = {}) {
  const m = String(url).match(/\/waInstance[^/]+\/([A-Za-z]+)\/[^/?]+(\?.*)?$/)
  if (!m || !GREEN_READ_TTL[m[1]] || (typeof FormData !== 'undefined' && init.body instanceof FormData)) return null
  return { method: m[1], key: `${m[1]}${m[2] || ''}|${typeof init.body === 'string' ? init.body : ''}` }
}
