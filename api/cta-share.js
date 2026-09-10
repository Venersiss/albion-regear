import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function randomShareToken() {
  return crypto.randomBytes(24).toString('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!bearer) return res.status(401).json({ error: 'Administrator authentication is required.' })
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: userResult, error: userError } = await admin.auth.getUser(bearer)
  if (userError || !userResult?.user) return res.status(401).json({ error: 'Your administrator session has expired.' })
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { data: sheet, error: sheetError } = await admin.from('cta_sheets').select('id, guild_id, name').eq('id', body.sheetId).maybeSingle()
  if (sheetError) return res.status(500).json({ error: sheetError.message })
  if (!sheet) return res.status(404).json({ error: 'CTA sheet not found.' })
  const { data: membership, error: membershipError } = await admin.from('guild_admins').select('id').eq('guild_id', sheet.guild_id).eq('user_id', userResult.user.id).maybeSingle()
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'You are not linked as an administrator for this guild.' })
  const token = randomShareToken()
  const { error: updateError } = await admin.from('cta_sheets').update({ share_token_hash: hashToken(token), updated_by: userResult.user.id, updated_by_name: userResult.user.user_metadata?.username || userResult.user.email || 'Administrator', updated_at: new Date().toISOString() }).eq('id', sheet.id)
  if (updateError) return res.status(500).json({ error: updateError.message })
  await admin.from('cta_activity').insert({ guild_id: sheet.guild_id, sheet_id: sheet.id, actor_id: userResult.user.id, actor_name: userResult.user.user_metadata?.username || userResult.user.email || 'Administrator', action: 'Public share link regenerated', entity_type: 'sheet', entity_id: sheet.id, details: {} })
  const origin = req.headers.origin || `https://${req.headers.host}`
  return res.status(200).json({ token, url: `${origin}/cta/${token}` })
}
