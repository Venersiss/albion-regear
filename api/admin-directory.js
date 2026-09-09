import { createClient } from '@supabase/supabase-js'

function authHeaders(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '')
}

function displayName(user) {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Administrator'
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = authHeaders(req)
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
  if (!membership) return res.status(403).json({ error: 'Only guild administrators can view administrator presence.' })

  if (req.method === 'POST') {
    const { error: presenceError } = await admin.from('admin_presence').upsert({ guild_id: guild.id, user_id: authData.user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'guild_id,user_id' })
    if (presenceError && presenceError.code !== '42P01') return res.status(500).json({ error: presenceError.message })
    return res.status(200).json({ ok: true, presenceConfigured: !presenceError })
  }

  const [{ data: guildAdmins, error: adminsError }, { data: userData, error: usersError }] = await Promise.all([
    admin.from('guild_admins').select('user_id, created_at').eq('guild_id', guild.id),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  if (adminsError) return res.status(500).json({ error: adminsError.message })
  if (usersError) return res.status(500).json({ error: usersError.message })

  const presenceResult = await admin.from('admin_presence').select('user_id, last_seen_at').eq('guild_id', guild.id)
  if (presenceResult.error && presenceResult.error.code !== '42P01') return res.status(500).json({ error: presenceResult.error.message })
  const presenceByUser = new Map((presenceResult.data || []).map((entry) => [entry.user_id, entry.last_seen_at]))
  const usersById = new Map((userData?.users || []).map((user) => [user.id, user]))
  const onlineCutoff = Date.now() - 3 * 60 * 1000
  const admins = (guildAdmins || []).map((entry) => {
    const user = usersById.get(entry.user_id)
    const lastSeenAt = presenceByUser.get(entry.user_id) || null
    const isCurrent = entry.user_id === authData.user.id
    return {
      id: entry.user_id,
      username: displayName(user),
      email: user?.email || 'Email unavailable',
      createdAt: entry.created_at,
      lastSeenAt,
      isCurrent,
      online: isCurrent || Boolean(lastSeenAt && new Date(lastSeenAt).getTime() >= onlineCutoff),
    }
  }).sort((first, second) => Number(second.online) - Number(first.online) || Number(second.isCurrent) - Number(first.isCurrent) || first.username.localeCompare(second.username, undefined, { sensitivity: 'base' }))

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ admins, presenceConfigured: !presenceResult.error })
}
