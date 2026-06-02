// Vercel serverless — Supermetrics API proxy
// Keeps the API key server-side; the browser never sees it.
//
// GET /api/supermetrics?source=fa|gawa|igi&range=<date_range_type>

const SUPERMETRICS_API_KEY = process.env.SUPERMETRICS_API_KEY || ''
const ADMIN_TOKEN          = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function checkAuth(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') === ADMIN_TOKEN
}

// One config block per data source.
// Field names follow Supermetrics Enterprise v2 naming conventions.
const SOURCES = {
  fa: {
    label:       'Facebook Ads',
    ds_id:       'FA',
    ds_accounts: 'list.all_accounts',
    ds_user:     '3729529637187426',
    fields: [
      'Date',
      'Campaign name',
      'Impressions',
      'Reach',
      'Clicks (all)',
      'Amount spent (USD)',
      'CTR (all)',
      'CPC (all)',
      'CPM (cost per 1,000 impressions)',
      'Frequency',
      'Conversions',
    ],
  },
  gawa: {
    label:       'Google Analytics',
    ds_id:       'GAWA',
    ds_accounts: 'list.all_accounts',
    ds_user:     'afik.hanahal@gmail.com',
    fields: [
      'Date',
      'Sessions',
      'Users',
      'New users',
      'Pageviews',
      'Bounce rate',
      'Avg. session duration',
      'Goal completions',
    ],
  },
  igi: {
    label:       'Instagram Insights',
    ds_id:       'IGI',
    ds_accounts: '17841445211723833',
    ds_user:     '3729535990520124',
    fields: [
      'Date',
      'Profile impressions',
      'Profile reach',
      'Followers',
      'Post impressions',
      'Post reach',
      'Post likes',
      'Post comments',
      'Post shares',
      'Post saves',
    ],
  },
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end() }
  cors(res)

  if (!checkAuth(req))        return res.status(401).json({ error: 'Unauthorized' })
  if (!SUPERMETRICS_API_KEY)  return res.status(500).json({ error: 'SUPERMETRICS_API_KEY not configured in Vercel env vars' })

  const source = (req.query.source || 'fa').toLowerCase()
  const range  = req.query.range   || 'last_7_days'
  const cfg    = SOURCES[source]

  if (!cfg) return res.status(400).json({ error: `Unknown source: ${source}. Use fa, gawa, or igi.` })

  const query = {
    ds_id:          cfg.ds_id,
    ds_accounts:    cfg.ds_accounts,
    ds_user:        cfg.ds_user,
    date_range_type: range,
    max_rows:       1000,
    api_key:        SUPERMETRICS_API_KEY,
    fields:         cfg.fields,
  }

  try {
    const url = `https://api.supermetrics.com/enterprise/v2/query/data/json?json=${encodeURIComponent(JSON.stringify(query))}`
    const r   = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const body = await r.json().catch(() => ({}))

    if (!r.ok) {
      const msg = body?.meta?.error || body?.error || `Supermetrics HTTP ${r.status}`
      return res.status(502).json({ error: msg })
    }
    if (body?.meta?.error) {
      return res.status(502).json({ error: body.meta.error })
    }

    return res.status(200).json({
      source,
      range,
      label:   cfg.label,
      headers: body?.data?.headers || [],
      rows:    body?.data?.rows    || [],
      meta:    body?.meta          || {},
    })
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Supermetrics request failed' })
  }
}
