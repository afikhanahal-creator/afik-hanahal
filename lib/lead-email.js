// The office's "new lead" email (website forms in api/contacts.js, Meta leads in api/meta.js). Pure; tested in
// lead-email.test.mjs. A wide card that uses the whole width: contact details as short rows, then the message on its own
// full-width block — a form's "question: answer · question: answer" text becomes one line per answer, and every piece of
// text the visitor typed is escaped and gets dir="auto", so an English message reads left-to-right inside the Hebrew mail.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const toIntl = raw => { const d = String(raw || '').replace(/\D/g, ''); return !d ? '' : d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d }
const ADMIN = 'https://www.afikhanahal.co.il/admin-panel'

/** "I own land · City / area: Hof HaSharon · When?: Exploring" → [{ a: 'I own land' }, { q: 'City / area', a: 'Hof HaSharon' }, …] */
export function messageParts(message) {
  const text = String(message || '').trim()
  if (!text) return []
  return text.split(/\s+·\s+|\n+/).map(s => s.trim()).filter(Boolean).map(seg => {
    const i = seg.indexOf(': ')
    return i > 0 && i <= 60 ? { q: seg.slice(0, i).trim(), a: seg.slice(i + 2).trim() } : { a: seg }
  })
}

/** page_service_land → "עמוד באתר · service · land"; other codes as they are */
export function sourceText(source) {
  const s = String(source || '')
  const m = /^page_([a-z]+)_(.+)$/.exec(s)
  return m ? `עמוד באתר · ${m[1]} · ${m[2]}` : s
}

export function buildLeadEmailHtml({ name, phone, email, message, propTitle, source, campaign, ts, badge }) {
  const intl = toIntl(phone)
  const local = intl.startsWith('972') ? '0' + intl.slice(3) : String(phone || '')
  const row = (label, value) => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #eef0f5;color:#8a8fa3;font-size:13px;white-space:nowrap;width:92px;vertical-align:top;text-align:right">${label}</td>
              <td style="padding:12px 0;border-bottom:1px solid #eef0f5;font-size:15px;color:#1a1a2e;text-align:right;vertical-align:top">${value}</td>
            </tr>`
  const rows = [
    name && row('שם', `<strong dir="auto" style="font-size:16px">${esc(name)}</strong>`),
    phone && row('טלפון', `<a href="https://wa.me/${intl}" style="color:#128C4B;font-weight:700;text-decoration:none" dir="ltr">${esc(local)}</a>
                <span style="color:#c9ccd8">&nbsp;·&nbsp;</span><a href="tel:${esc(phone)}" style="color:#3F4EB0;text-decoration:none;font-size:14px">חיוג</a>
                <span style="color:#c9ccd8">&nbsp;·&nbsp;</span><a href="https://wa.me/${intl}" style="color:#3F4EB0;text-decoration:none;font-size:14px">וואטסאפ</a>`),
    email && row('אימייל', `<a href="mailto:${esc(email)}" style="color:#3F4EB0;text-decoration:none" dir="ltr">${esc(email)}</a>`),
    campaign && row('קמפיין', `<span dir="auto" style="color:#3F4EB0;font-weight:600">${esc(campaign)}</span>`),
    propTitle && row('נכס / עמוד', `<span dir="auto" style="color:#3d4152">${esc(propTitle)}</span>`),
    source && row('מקור', `<span dir="auto" style="color:#5b6075;font-size:14px">${esc(sourceText(source))}</span>`),
    ts && row('התקבל', `<span style="color:#5b6075;font-size:14px">${esc(ts)}</span>`),
  ].filter(Boolean).join('')

  const parts = messageParts(message)
  const msgBlock = parts.length ? `
          <tr><td style="padding:6px 32px 4px">
            <div style="font-size:13px;color:#8a8fa3;margin:14px 0 8px;text-align:right">ההודעה</div>
            <div style="background:#f7f8fc;border:1px solid #eceef6;border-radius:12px;padding:6px 18px">
              ${parts.map((p, i) => `
              <div style="padding:10px 0;${i ? 'border-top:1px solid #eceef6;' : ''}">
                ${p.q ? `<div dir="auto" style="font-size:12.5px;color:#8a8fa3;margin-bottom:3px">${esc(p.q)}</div>` : ''}
                <div dir="auto" style="font-size:15px;line-height:1.65;color:#1a1a2e;${p.q && p.a.length <= 60 ? 'font-weight:600;' : ''}white-space:pre-wrap">${esc(p.a)}</div>
              </div>`).join('')}
            </div>
          </td></tr>` : ''

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,'Helvetica Neue',sans-serif;direction:rtl">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f7;padding:24px 10px">
    <tr><td align="center">
      <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%">
        <tr><td style="background:#1a1a2e;border-radius:16px 16px 0 0;padding:22px 32px;text-align:right">
          <div style="color:#AAB3EE;font-size:13px;font-weight:600;margin-bottom:4px">אפיק הנחל - ייזום שיווק ותיווך</div>
          <div style="color:#fff;font-size:21px;font-weight:800">${esc(badge || 'ליד חדש התקבל')}</div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 32px 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
              </table>
            </td></tr>${msgBlock}
            <tr><td style="padding:22px 32px 26px;text-align:center">
              <a href="${ADMIN}" style="display:inline-block;background:#3F4EB0;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:999px">פתיחה במערכת הניהול</a>
              ${intl ? `&nbsp;&nbsp;<a href="https://wa.me/${intl}" style="display:inline-block;background:#25D366;color:#06301A;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px">וואטסאפ ללקוח</a>` : ''}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 0 0;text-align:center;font-size:12px;color:#9aa0b4">נשלח אוטומטית ממערכת ה-CRM של אפיק הנחל</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
