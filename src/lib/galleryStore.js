// The gallery's own folders for every screen that opens the gallery (lib/gallery-folders.js): read once from
// GET /api/meta/gallery-folders, changed with operations — galleryOps([{ op, id, … }]) — that are applied here at once
// (optimistic) and sent to the server one batch at a time, in order (operations made while a batch is on its way go in the
// next one), so a burst of uploads never races itself. A failed save re-reads the server's list.
import { useEffect, useState } from 'react'
import { cleanFolders, applyFolderOps } from '../../lib/gallery-folders.js'

const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
let list = []
let loaded = false, loading = null
let queue = [], flushing = null
const subs = new Set()
const emit = () => { for (const f of [...subs]) { try { f({ folders: list, loaded }) } catch { /* one screen never stops the others */ } } }

export function loadGalleryFolders(force = false) {
  if (loading && !force) return loading
  loading = fetch('/api/meta/gallery-folders', { headers: AUTH, signal: AbortSignal.timeout(15000) })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
    .then(d => { list = applyFolderOps(cleanFolders(d.folders), queue).folders; loaded = true; emit() })
    .catch(() => { loading = null })
  return loading
}

export function useGalleryFolders(active = true) {
  const [s, setS] = useState({ folders: list, loaded })
  useEffect(() => { setS({ folders: list, loaded }); subs.add(setS); return () => subs.delete(setS) }, [])
  useEffect(() => { if (active && !loaded) loadGalleryFolders() }, [active])
  return s
}

/** → { ok, errors: [words], error? } once everything asked so far is saved */
export function galleryOps(ops) {
  const add = (Array.isArray(ops) ? ops : []).filter(Boolean)
  if (!add.length) return Promise.resolve({ ok: true, errors: [] })
  queue.push(...add)
  list = applyFolderOps(list, add).folders
  emit()
  if (!flushing) {
    flushing = (async () => {
      const out = { ok: true, errors: [] }
      while (queue.length) {
        const batch = queue.slice(0, 60)
        try {
          const r = await fetch('/api/meta/gallery-folders', { method: 'POST', headers: AUTH, body: JSON.stringify({ ops: batch }), signal: AbortSignal.timeout(20000) })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d.error || 'השמירה נכשלה')
          queue = queue.slice(batch.length)
          out.errors.push(...(d.errors || []))
          list = applyFolderOps(cleanFolders(d.folders), queue).folders
          loaded = true
          emit()
        } catch (e) {
          queue = []
          out.ok = false; out.error = e?.name === 'TimeoutError' ? 'השמירה לא הושלמה, בדקו את החיבור ונסו שוב' : (e.message || 'השמירה נכשלה')
          await loadGalleryFolders(true)
          break
        }
      }
      flushing = null
      return out
    })()
  }
  return flushing
}
