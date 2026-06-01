import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL || ''
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Returns null when env vars are not configured — callers must guard with `if (supabase)`
export const supabase = URL && KEY ? createClient(URL, KEY) : null
