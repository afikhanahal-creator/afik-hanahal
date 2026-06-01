// Vercel serverless — sends a test email using Gmail credentials from env vars
import nodemailer from 'nodemailer'

const ADMIN_TOKEN = 'AFIKhanahal2026'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    return res.status(500).json({
      error: 'GMAIL_USER / GMAIL_APP_PASSWORD לא מוגדרים ב-Vercel env vars',
    })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: `"אפיק הנחל CRM" <${user}>`,
      to: user,
      subject: '✅ בדיקת אימייל — מערכת CRM אפיק הנחל',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;direction:rtl;max-width:480px;margin:0 auto">
          <h2 style="color:#8490D8;margin-bottom:8px">✅ אימייל בדיקה נשלח בהצלחה!</h2>
          <p style="color:#333;line-height:1.7">מערכת האימייל של <strong>אפיק הנחל CRM</strong> פועלת כראוי.</p>
          <p style="color:#666;font-size:13px">נשלח מ-${user}</p>
        </div>`,
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[test-email]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
