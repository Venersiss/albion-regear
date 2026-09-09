import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const inviteId = String(req.body?.inviteId || '').trim()
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })
  if (!token) return res.status(401).json({ error: 'Your administrator session has expired. Sign in again.' })
  if (!inviteId) return res.status(400).json({ error: 'The invitation ID is missing.' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return res.status(401).json({ error: 'Your administrator session is invalid. Sign in again.' })
  const { data: guild, error: guildError } = await admin.from('guilds').select('id').eq('public_slug', 'coup-de-grace').maybeSingle()
  if (guildError) return res.status(500).json({ error: guildError.message })
  if (!guild) return res.status(404).json({ error: 'Coup De Grace was not found.' })
  const { data: membership, error: membershipError } = await admin.from('guild_admins').select('guild_id').eq('guild_id', guild.id).eq('user_id', authData.user.id).maybeSingle()
  if (membershipError) return res.status(500).json({ error: membershipError.message })
  if (!membership) return res.status(403).json({ error: 'Only an existing guild administrator can cancel invitations.' })

  const { data: invite, error: inviteError } = await admin.from('admin_invites').select('id, email, invited_user_id, accepted_at').eq('id', inviteId).eq('guild_id', guild.id).maybeSingle()
  if (inviteError) return res.status(500).json({ error: inviteError.message })
  if (!invite) return res.status(404).json({ error: 'Invitation not found.' })
  if (invite.accepted_at) return res.status(409).json({ error: 'This invitation has already been accepted and cannot be canceled.' })

  let invitedUserId = invite.invited_user_id
  if (!invitedUserId) {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    invitedUserId = users?.users?.find((user) => user.email?.toLowerCase() === invite.email?.toLowerCase())?.id
  }
  if (invitedUserId) {
    const { data: invitedUser } = await admin.auth.admin.getUserById(invitedUserId)
    if (invitedUser?.user && !invitedUser.user.last_sign_in_at) {
      await admin.from('guild_admins').delete().eq('guild_id', guild.id).eq('user_id', invitedUserId)
      const { error: deleteError } = await admin.auth.admin.deleteUser(invitedUserId)
      if (deleteError) return res.status(500).json({ error: deleteError.message })
    }
  }
  const { error: removeError } = await admin.from('admin_invites').delete().eq('id', invite.id).eq('guild_id', guild.id)
  if (removeError) return res.status(500).json({ error: removeError.message })
  return res.status(200).json({ message: 'Invitation canceled.' })
}
