// Lead card → "שיחת וואטסאפ": the whole WhatsApp conversation with the lead (Green API history, read-only) and an AI
// summary of it (POST /api/meta/chat-summary → lib/chat-summary.js): what was discussed, what the lead wants, what was
// agreed, open questions, the next step, the suggested stage (one click to move the lead there), a follow-up date and
// "save as a note". The summary is kept on the lead (crm_data.chatSummary) and says when new messages arrived since.
import { useState, useEffect, useRef, useCallback } from 'react'
import { FaWhatsapp, FaMagic, FaSyncAlt, FaExternalLinkAlt, FaBullseye, FaQuestionCircle, FaHandshake, FaComments, FaClock, FaStickyNote, FaCheck, FaArrowLeft, FaArrowRight, FaMicrophone, FaUser } from 'react-icons/fa'
import { T } from './automationsUI.jsx'
import { normalizeChat } from '../lib/chat-format.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }

const TR = {
  he: {
    aiTitle: 'סיכום AI של השיחה', aiSub: 'קורא את כל ההתכתבות ומסכם: על מה דיברנו, מה הליד מחפש, מה סוכם, מה פתוח, ובאיזה שלב הוא צריך להיות.',
    summarize: 'סכם את השיחה', resummarize: 'סכם מחדש', summarizing: 'קורא את השיחה ומסכם…', updated: (w, n) => `עודכן ${w} · ${n} הודעות`,
    newSince: n => `${n} הודעות חדשות מאז הסיכום`, wants: 'מה הליד מחפש', topics: 'על מה דיברנו', agreed: 'מה סוכם', open: 'שאלות ונושאים פתוחים', next: 'הצעד הבא',
    temp: { hot: 'חם', warm: 'פושר', cold: 'קר' }, waiting: 'הליד מחכה לתשובה', stage: 'שלב מומלץ', move: s => `העבר ל"${s}"`, moved: 'הליד כבר בשלב הזה',
    followUp: 'מעקב מומלץ', fuIn: n => (n === 0 ? 'היום' : n === 1 ? 'מחר' : `בעוד ${n} ימים`), setFu: 'קבע מעקב', fuSet: 'המעקב נקבע', noFu: 'אין צורך במעקב כרגע',
    saveNote: 'שמור כהערה', noteSaved: 'נשמר בהיסטוריה', notePrefix: 'סיכום שיחת וואטסאפ (AI)',
    voice: n => `${n} הודעות קוליות לא תומללו — ה-AI קורא טקסט בלבד`,
    convo: 'ההתכתבות', loading: 'טוען את השיחה…', empty: 'עוד אין התכתבות בוואטסאפ עם הליד הזה.', noPhone: 'לליד אין מספר טלפון.', loadErr: 'לא הצלחנו לטעון את השיחה', retry: 'נסה שוב',
    refresh: 'רענון', openChat: 'פתח בצ׳אט', lead: 'הליד', office: 'אנחנו', today: 'היום', yesterday: 'אתמול', count: n => `${n} הודעות`,
    errs: { empty: 'אין עדיין שיחה לסכם.', no_key: 'לא הוגדר מפתח ANTHROPIC_API_KEY ב-Vercel.', auth: 'מפתח ה-API של Claude לא תקין.', rate: 'יותר מדי בקשות כרגע, נסו שוב בעוד דקה.', other: 'הסיכום נכשל' },
  },
  en: {
    aiTitle: 'AI conversation summary', aiSub: 'Reads the whole chat and sums up what we talked about, what the lead wants, what was agreed, what is open, and which stage they belong in.',
    summarize: 'Summarize the chat', resummarize: 'Summarize again', summarizing: 'Reading the chat and summarizing…', updated: (w, n) => `Updated ${w} · ${n} messages`,
    newSince: n => `${n} new messages since the summary`, wants: 'What the lead wants', topics: 'What we talked about', agreed: 'What was agreed', open: 'Open questions and issues', next: 'Next step',
    temp: { hot: 'Hot', warm: 'Warm', cold: 'Cold' }, waiting: 'The lead is waiting for an answer', stage: 'Suggested stage', move: s => `Move to “${s}”`, moved: 'The lead is already in this stage',
    followUp: 'Suggested follow-up', fuIn: n => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`), setFu: 'Set follow-up', fuSet: 'Follow-up set', noFu: 'No follow-up needed right now',
    saveNote: 'Save as a note', noteSaved: 'Saved to the history', notePrefix: 'WhatsApp conversation summary (AI)',
    voice: n => `${n} voice notes were not transcribed — the AI reads text only`,
    convo: 'The conversation', loading: 'Loading the conversation…', empty: 'No WhatsApp conversation with this lead yet.', noPhone: 'This lead has no phone number.', loadErr: 'Could not load the conversation', retry: 'Try again',
    refresh: 'Refresh', openChat: 'Open in chat', lead: 'Lead', office: 'Us', today: 'Today', yesterday: 'Yesterday', count: n => `${n} messages`,
    errs: { empty: 'There is no conversation to summarize yet.', no_key: 'ANTHROPIC_API_KEY is not set in Vercel.', auth: 'The Claude API key is invalid.', rate: 'Too many requests right now, try again in a minute.', other: 'The summary failed' },
  },
}
const TEMP_COLOR = { hot: '#EF4444', warm: '#F59E0B', cold: '#60A5FA' }
const dayKey = ts => new Date(ts).toDateString()
const pad = n => String(n).padStart(2, '0')
const localInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function Block({ icon: Ic, title, color = T.brandText, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, color: T.text2, marginBottom: 6 }}><Ic size={11} style={{ color }}/>{title}</div>
      {children}
    </div>
  )
}
const Lines = ({ items, color }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
    {items.map((x, i) => <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, color: T.text }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 8 }}/><span>{x}</span></li>)}
  </ul>
)

export default function LeadChatTab({ lead, lang = 'he', stages = [], save, onUpdateStatus, onOpenChat, onClose }) {
  const t = TR[lang] || TR.he
  const [chat, setChat] = useState({ phase: lead.phone ? 'loading' : 'nophone', msgs: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState({})
  const scrollRef = useRef(null)
  const sum = lead.chatSummary || null
  const fmt = ts => { try { return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
  const time = ts => { try { return new Date(ts).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
  const dayLabel = ts => { const d = dayKey(ts); if (d === dayKey(Date.now())) return t.today; if (d === dayKey(Date.now() - 864e5)) return t.yesterday; return new Date(ts).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) }
  const stageName = id => { const g = stages.find(x => x.id === id); return g ? (lang === 'en' ? g.en : g.label) : id }

  const load = useCallback(async () => {
    if (!lead.phone) return
    setChat(c => ({ ...c, phase: c.msgs.length ? 'refreshing' : 'loading' }))
    try {
      const r = await fetch('/api/meta/chat-history', { method: 'POST', headers: H, body: JSON.stringify({ phone: lead.phone, count: 200 }), signal: AbortSignal.timeout(25000) })
      const d = await r.json().catch(() => null)
      if (!r.ok || !Array.isArray(d)) throw new Error(d?.error || `HTTP ${r.status}`)
      setChat({ phase: 'ready', msgs: normalizeChat(d) })
    } catch (e) { setChat(c => ({ ...c, phase: c.msgs.length ? 'ready' : 'error', error: e.message })) }
  }, [lead.phone])
  useEffect(() => { load() }, [load])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [chat.msgs.length])

  const summarize = async () => {
    setBusy(true); setErr('')
    try {
      const { enrichment: _e, ...clean } = lead
      const r = await fetch('/api/meta/chat-summary', { method: 'POST', headers: H, body: JSON.stringify({ lead: clean }), signal: AbortSignal.timeout(70000) })
      const d = await r.json().catch(() => ({}))
      if (!d.ok) { setErr(t.errs[d.code] || `${t.errs.other}: ${d.error || `HTTP ${r.status}`}`); return }
      await save({ chatSummary: d.summary })
      setDone({})
      load()
    } catch (e) { setErr(`${t.errs.other}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`) }
    finally { setBusy(false) }
  }

  const cur = lead.leadStatus || 'new'
  const newSince = sum && chat.phase !== 'loading' ? Math.max(0, chat.msgs.length - (sum.msgCount || 0)) : 0
  const fuDate = sum && sum.followUpDays >= 0 ? (() => { const d = new Date(); d.setDate(d.getDate() + sum.followUpDays); d.setHours(10, 0, 0, 0); return d })() : null
  const btn = (primary, extra = {}) => ({ height: 32, padding: '0 12px', borderRadius: 8, border: primary ? 'none' : `1px solid ${T.s1Line}`, background: primary ? 'var(--au-brand)' : 'transparent', color: primary ? '#fff' : T.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', ...extra })
  const card = { background: T.card, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 16 }

  const summaryCard = (
    <section style={card} aria-busy={busy}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: sum || busy || err ? 12 : 6 }}>
        <FaMagic size={12} style={{ color: T.brandText }}/>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.text }}>{t.aiTitle}</h3>
        {sum && <span style={{ height: 22, padding: '0 9px', borderRadius: 20, background: `${TEMP_COLOR[sum.temperature]}1f`, color: TEMP_COLOR[sum.temperature], fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>{t.temp[sum.temperature]}</span>}
        {sum?.lastWord === 'lead' && <span style={{ height: 22, padding: '0 9px', borderRadius: 20, background: 'rgba(239,68,68,.12)', color: '#EF4444', fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>{t.waiting}</span>}
        <span style={{ flex: 1 }}/>
        {sum && <span style={{ fontSize: 11.5, color: T.text3 }}>{t.updated(fmt(sum.at), sum.msgCount)}</span>}
        {lead.phone && <button type="button" style={btn(!sum)} disabled={busy} onClick={summarize}>{busy ? <FaSyncAlt size={10} style={{ animation: 'lc-spin 1s linear infinite' }}/> : <FaMagic size={10}/>}{busy ? t.summarizing : sum ? t.resummarize : t.summarize}</button>}
      </header>
      {!sum && !busy && !err && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.text2 }}>{t.aiSub}</p>}
      {err && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: '#EF4444' }}>{err}</p>}
      {sum && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: busy ? .55 : 1 }}>
          {newSince > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: T.brandText, background: T.brandSoft, borderRadius: 8, padding: '6px 10px', alignSelf: 'flex-start' }}>{t.newSince(newSince)}</div>}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: T.text }}>{sum.summary}</p>
          {sum.leadWants && <Block icon={FaBullseye} title={t.wants}><p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.text }}>{sum.leadWants}</p></Block>}
          <div className="lc-grid3">
            {sum.topics?.length > 0 && <Block icon={FaComments} title={t.topics}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sum.topics.map((x, i) => <span key={i} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'rgba(var(--ov),.06)', color: T.text }}>{x}</span>)}</div></Block>}
            {sum.agreed?.length > 0 && <Block icon={FaHandshake} title={t.agreed} color="#22C55E"><Lines items={sum.agreed} color="#22C55E"/></Block>}
            {sum.openQuestions?.length > 0 && <Block icon={FaQuestionCircle} title={t.open} color="#F59E0B"><Lines items={sum.openQuestions} color="#F59E0B"/></Block>}
          </div>
          {sum.nextStep && <div style={{ borderInlineStart: '3px solid var(--au-brand)', background: T.brandSoft, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.brandText, marginBottom: 3 }}>{t.next}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text }}>{sum.nextStep}</div>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
            {sum.suggestedStage && <div style={{ border: `1px solid ${T.s1Line}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text3 }}>{t.stage}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{stageName(sum.suggestedStage)}</span>
                {sum.suggestedStage === cur
                  ? <span style={{ fontSize: 12, color: T.green, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FaCheck size={9}/>{t.moved}</span>
                  : <button type="button" style={btn(true, { height: 28 })} onClick={() => (onUpdateStatus ? onUpdateStatus(lead, sum.suggestedStage) : save({ leadStatus: sum.suggestedStage }))}>{lang === 'en' ? <FaArrowRight size={9}/> : <FaArrowLeft size={9}/>}{t.move(stageName(sum.suggestedStage))}</button>}
              </div>
              {sum.stageReason && <div style={{ fontSize: 12, lineHeight: 1.55, color: T.text2 }}>{sum.stageReason}</div>}
            </div>}
            <div style={{ border: `1px solid ${T.s1Line}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text3 }}>{t.followUp}</div>
              {fuDate ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: T.text, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FaClock size={11} style={{ color: T.text3 }}/>{t.fuIn(sum.followUpDays)}</span>
                {done.fu ? <span style={{ fontSize: 12, color: T.green, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FaCheck size={9}/>{t.fuSet}</span>
                  : <button type="button" style={btn(false, { height: 28 })} onClick={() => save({ followUp: localInput(fuDate) }).then(ok => ok && setDone(d => ({ ...d, fu: true })))}>{t.setFu}</button>}
              </div> : <span style={{ fontSize: 13, color: T.text2 }}>{t.noFu}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {done.note ? <span style={{ fontSize: 12, color: T.green, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FaCheck size={9}/>{t.noteSaved}</span>
              : <button type="button" style={btn(false)} onClick={() => {
                const text = [`${t.notePrefix}: ${sum.summary}`, sum.agreed?.length ? `${t.agreed}: ${sum.agreed.join('; ')}` : '', sum.nextStep ? `${t.next}: ${sum.nextStep}` : ''].filter(Boolean).join('\n')
                const notes = Array.isArray(lead.notes) ? lead.notes : []
                save({ notes: [...notes, { id: Math.random().toString(36).slice(2, 10), text, ts: Date.now(), kind: 'wa' }] }).then(ok => ok && setDone(d => ({ ...d, note: true })))
              }}><FaStickyNote size={10}/>{t.saveNote}</button>}
            {sum.voiceNotes > 0 && <span style={{ fontSize: 11.5, color: T.text3, display: 'inline-flex', alignItems: 'center', gap: 5 }}><FaMicrophone size={10}/>{t.voice(sum.voiceNotes)}</span>}
          </div>
        </div>
      )}
    </section>
  )

  let lastDay = ''
  const conversation = (
    <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.line}` }}>
        <FaWhatsapp size={13} style={{ color: '#25D366' }}/>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.text, flex: 1 }}>{t.convo}{chat.msgs.length ? <span style={{ fontWeight: 500, color: T.text3, fontSize: 12 }}> · {t.count(chat.msgs.length)}</span> : null}</h3>
        {lead.phone && <button type="button" style={btn(false, { height: 28 })} onClick={load} disabled={chat.phase === 'loading' || chat.phase === 'refreshing'}><FaSyncAlt size={9} style={chat.phase === 'refreshing' ? { animation: 'lc-spin 1s linear infinite' } : undefined}/>{t.refresh}</button>}
        {lead.phone && onOpenChat && <button type="button" style={btn(false, { height: 28 })} onClick={() => { onOpenChat(lead); onClose?.() }}><FaExternalLinkAlt size={9}/>{t.openChat}</button>}
      </header>
      <div ref={scrollRef} style={{ maxHeight: 460, minHeight: 120, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(var(--ov),.025)' }}>
        {chat.phase === 'nophone' && <p style={{ margin: 'auto', color: T.text3, fontSize: 13 }}>{t.noPhone}</p>}
        {chat.phase === 'loading' && <p style={{ margin: 'auto', color: T.text3, fontSize: 13 }}>{t.loading}</p>}
        {chat.phase === 'error' && <p style={{ margin: 'auto', color: T.text3, fontSize: 13, textAlign: 'center' }}>{t.loadErr} ({chat.error}) <button type="button" style={btn(false, { height: 26, marginInlineStart: 6 })} onClick={load}>{t.retry}</button></p>}
        {(chat.phase === 'ready' || chat.phase === 'refreshing') && !chat.msgs.length && <p style={{ margin: 'auto', color: T.text3, fontSize: 13 }}>{t.empty}</p>}
        {chat.msgs.map((m, i) => {
          const d = dayKey(m.ts), showDay = d !== lastDay; lastDay = d
          const out = m.dir === 'out'
          return [
            showDay && <div key={'d' + i} style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: T.text3, background: T.card, border: `1px solid ${T.s1Line}`, borderRadius: 20, padding: '2px 10px', margin: '6px 0' }}>{dayLabel(m.ts)}</div>,
            <div key={i} style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '78%', background: out ? 'rgba(37,211,102,.14)' : T.card, border: `1px solid ${out ? 'rgba(37,211,102,.25)' : T.s1Line}`, borderRadius: 12, padding: '7px 11px', fontSize: 13, lineHeight: 1.55, color: T.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: out ? '#1FAF55' : T.text3, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>{!out && <FaUser size={8}/>}{out ? t.office : (lead.name || t.lead)}</div>
              {m.media && <div style={{ fontStyle: 'italic', color: T.text2, display: 'flex', alignItems: 'center', gap: 5 }}>{/קולית|voice/i.test(m.media) && <FaMicrophone size={10}/>}[{m.media}]</div>}
              {m.text && <div dir="auto">{m.text}</div>}
              <div style={{ fontSize: 10.5, color: T.text3, textAlign: 'end', marginTop: 2 }}>{time(m.ts)}</div>
            </div>,
          ]
        })}
      </div>
    </section>
  )

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{summaryCard}{conversation}</div>
}
