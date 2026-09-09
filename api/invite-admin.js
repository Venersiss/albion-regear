import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const email = String(req.body?.email || '').trim().toLowerCase()

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })
  if (!token) return res.status(401).json({ error: 'Your administrator session has expired. Sign in again.' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return res.status(401).json({ error: 'Your administrator session is invalid. Sign in again.' })

  const { data: guild, error: guildError } = await admin.from('guilds').select('id, name').eq('public_slug', 'coup-de-grace').maybeSingle()
  if (guildError) return res.status(500).json({ error: guildError.message })
  if (!guild) return res.status(404).json({ error: 'Coup De Grace was not found.' })

  const { data: membership, error: membershipError } = await admin.from('guild_admins').select('guild_id').eq('guild_id', guild.id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'Only an existing guild administrator can send invitations.' })

  const { data: pending, error: pendingError } = await admin.from('admin_invites').select('id').eq('guild_id', guild.id).eq('email', email).is('accepted_at', null).maybeSingle()
  if (pendingError) return res.status(500).json({ error: pendingError.message })
  if (pending) return res.status(409).json({ error: 'That email already has a pending invitation.' })

  const redirectTo = process.env.APP_URL || 'https://albion-regear.vercel.app'
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${redirectTo.replace(/\/$/, '')}/` })
  if (inviteError) {
    const rateLimited = inviteError.status === 429 || /rate.?limit|too many|email limit/i.test(inviteError.message || '')
    return res.status(rateLimited ? 429 : 400).json({ error: rateLimited ? 'Supabase email rate limit reached. Wait for the limit to reset or configure custom SMTP in Supabase Authentication settings before sending more invitations.' : inviteError.message })
  }

  const invitedUser = inviteData.user
  const { error: linkError } = await admin.from('guild_admins').upsert({ guild_id: guild.id, user_id: invitedUser.id }, { onConflict: 'guild_id,user_id' })
  if (linkError) return res.status(500).json({ error: `The invitation was sent, but admin access could not be linked: ${linkError.message}` })

  const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex')
  const { error: recordError } = await admin.from('admin_invites').insert({ guild_id: guild.id, email, invited_by: authData.user.id, invited_user_id: invitedUser.id, token_hash: tokenHash })
  if (recordError) return res.status(500).json({ error: `The invitation was sent, but it could not be recorded: ${recordError.message}` })

  return res.status(200).json({ message: `Invitation sent to ${email}.`, email })
}
