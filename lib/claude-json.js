// One structured-output call to Claude (server side), shared by the lead analysis and the WhatsApp chat summary.
// Handles the key quirks we met in production: a stray space in the pasted key, an Admin key, and a key created outside a
// workspace (ANTHROPIC_WORKSPACE_ID, else the organization's default workspace once). → { data, model } | { error, code }
import Anthropic from '@anthropic-ai/sdk'

export async function claudeJson({ system, user, schema, model, maxTokens = 8000, effort = 'medium', timeout = 45000 }) {
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'ANTHROPIC_API_KEY is not set in Vercel', code: 'no_key' }
  const workspace = String(process.env.ANTHROPIC_WORKSPACE_ID || '').trim()
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim()   // a pasted key often carries a stray space / newline
  if (/^sk-ant-admin/.test(apiKey)) return { error: 'ANTHROPIC_API_KEY is an Admin key (sk-ant-admin…) — admin keys cannot send messages. Create a regular API key inside a workspace', code: 'admin_key' }
  const makeClient = ws => new Anthropic({ apiKey, timeout, maxRetries: 1, ...(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}) })
  let client = makeClient(workspace)
  const notScoped = e => e instanceof Anthropic.BadRequestError && /not scoped to a workspace|anthropic-workspace-id/i.test(e.message || '')
  const create = () => client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  })
  try {
    let res
    try { res = await create() }
    catch (e) {
      // A key without a workspace and no ANTHROPIC_WORKSPACE_ID: try the organization's default workspace once
      if (!notScoped(e) || workspace) throw e
      client = makeClient('default')
      res = await create()
    }
    if (res.stop_reason === 'refusal') return { error: 'The model declined this request', code: 'refusal' }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
    return { data: JSON.parse(text), model: res.model }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'ANTHROPIC_API_KEY is invalid', code: 'auth' }
    if (e instanceof Anthropic.RateLimitError) return { error: 'Rate limited – try again in a minute', code: 'rate' }
    if (notScoped(e)) return { error: 'The API key is not tied to a workspace: create a new key inside a workspace (Console → Workspaces → Default → API keys) and put it in ANTHROPIC_API_KEY, or set ANTHROPIC_WORKSPACE_ID in Vercel', code: 'workspace' }
    if (e instanceof Anthropic.APIError) return { error: `Claude API ${e.status}: ${e.message}`, code: 'api' }
    if (e instanceof SyntaxError) return { error: 'Could not read the model output', code: 'parse' }
    return { error: e.message || 'AI request failed', code: 'network' }
  }
}
