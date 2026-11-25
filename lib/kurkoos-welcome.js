// The welcome a Kurkoos Group site lead gets from the office WhatsApp (api/meta.js handleKurkoosLead). Tested in
// lib/kurkoos-welcome.test.mjs. It ends with the time question, like the office's own welcome templates.
export function kurkoosWelcomeText({ name = '', topic = '' } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}'׳"-]/gu, '').slice(0, 30)
  const about = String(topic || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\b(?:https?:\/\/|www\.)\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return `היי${first ? ` ${first}` : ''}, ראינו שהשארתם פרטים באתר של קבוצת קורקוס${about ? ` לגבי ${about}` : ''}.\nמתי נוח לכם שנדבר, היום או מחר?`
}
