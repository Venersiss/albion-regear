import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })
  if (!token) return res.status(401).json({ error: 'Your administrator session has expired. Sign in again.' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return res.status(401).json({ error: 'Your administrator session is invalid. Sign in again.' })
  const { data: guild, error: guildError } = await admin.from('guilds').select('id').eq('public_slug', 'coup-de-grace').maybeSingle()
  if (guildError) return res.status(500).json({ error: guildError.message })
  if (!guild) return res.status(404).json({ error: 'Coup De Grace was not found.' })
  const { data: membership, error: membershipError } = await admin.from('guild_admins').select('guild_id').eq('guild_id', guild.id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'Only guild administrators can view invitations.' })

  const { data: invites, error: inviteError } = await admin.from('admin_invites').select('id, email, invited_user_id, created_at, expires_at, accepted_at').eq('guild_id', guild.id).order('created_at', { ascending: false })
  if (inviteError) return res.status(500).json({ error: inviteError.message })
  const users = {}
  const missingEmailInvites = (invites || []).filter((invite) => !invite.invited_user_id)
  if (missingEmailInvites.length) {
    const { data: userData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const user of userData?.users || []) users[user.email?.toLowerCase()] = user
  }
  const normalized = []
  for (const invite of invites || []) {
    let user = null
    if (invite.invited_user_id) user = (await admin.auth.admin.getUserById(invite.invited_user_id)).data?.user || null
    else user = users[invite.email?.toLowerCase()] || null
    const acceptedAt = invite.accepted_at || user?.last_sign_in_at || user?.confirmed_at || null
    if (acceptedAt && !invite.accepted_at) await admin.from('admin_invites').update({ accepted_at: acceptedAt, accepted_by: user?.id || invite.invited_user_id }).eq('id', invite.id).eq('guild_id', guild.id)
    normalized.push({ ...invite, accepted_at: acceptedAt, status: acceptedAt ? 'accepted' : new Date(invite.expires_at).getTime() < Date.now() ? 'expired' : 'pending' })
  }
  return res.status(200).json({ invites: normalized })
}
