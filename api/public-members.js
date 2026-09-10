import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: guild, error: guildError } = await admin.from('guilds').select('id, name, public_access_enabled').eq('public_slug', 'coup-de-grace').maybeSingle()
  if (guildError) return res.status(500).json({ error: guildError.message })
  if (!guild || guild.public_access_enabled === false) return res.status(404).json({ error: 'Public member access is not enabled.' })

  const [membersResult, requestsResult, eventsResult, itemLinesResult] = await Promise.all([
    admin.from('members').select('id, character_name, role, issue_chest').eq('guild_id', guild.id).eq('active', true).order('character_name'),
    admin.from('regear_requests').select('*').eq('guild_id', guild.id).order('created_at', { ascending: false }),
    admin.from('regear_events').select('id, event_date, name').eq('guild_id', guild.id),
    admin.from('regear_request_items').select('id, regear_request_id, category, item_name, quantity, sort_order').order('sort_order'),
  ])
  if (membersResult.error) return res.status(500).json({ error: membersResult.error.message })
  if (requestsResult.error) return res.status(500).json({ error: requestsResult.error.message })
  const events = eventsResult.error ? [] : (eventsResult.data || [])
  const itemLines = itemLinesResult.error ? [] : (itemLinesResult.data || [])
  const eventById = new Map(events.map((event) => [event.id, event]))
  const latestRequests = new Map()
  const requestHistory = new Map()
  for (const request of requestsResult.data || []) {
    if (!latestRequests.has(request.member_id)) latestRequests.set(request.member_id, request)
    const event = eventById.get(request.event_id)
    const lines = itemLines.filter((item) => item.regear_request_id === request.id).sort((first, second) => (first.sort_order || 0) - (second.sort_order || 0)).map((item) => ({ id: item.id, category: item.category, name: item.item_name, quantity: Number(item.quantity || 1), sortOrder: item.sort_order || 0 }))
    const legacyLines = [['Weapon', request.weapon], ['Off hand', request.off_hand], ['Head', request.helmet], ['Armor', request.armor], ['Boots', request.boots]].filter(([, name]) => name).map(([category, name], index) => ({ id: `legacy-${request.id}-${index}`, category, name, quantity: 1, sortOrder: index }))
    const history = requestHistory.get(request.member_id) || []
    const status = request.status === 'archived' ? request.archived_from_status || 'open' : request.status
    history.push({ id: request.id, status, role: request.role, diedAt: request.died_at || request.created_at, deathNote: request.death_note || '', chest: request.issue_chest || 'Unassigned', eventName: event?.name || 'Unassigned event', items: lines.length ? lines : legacyLines, weapon: request.weapon || '', offHand: request.off_hand || '', helmet: request.helmet || '', armor: request.armor || '', boots: request.boots || '', regearedAt: request.regeared_at || null, regearedBy: request.regeared_by_name || '', reportedBy: request.reported_by_name || '' })
    requestHistory.set(request.member_id, history)
  }

  const members = (membersResult.data || []).map((member) => {
    const request = latestRequests.get(member.id)
    const status = request?.status === 'archived' ? request.archived_from_status || 'open' : request?.status
    return { id: member.id, name: member.character_name, role: member.role, chest: member.issue_chest || 'Unassigned', status: status === 'regeared' ? 'regeared' : request ? 'open' : 'none', diedAt: request?.died_at || null, regearedAt: request?.regeared_at || null, history: requestHistory.get(member.id) || [] }
  }).sort((first, second) => {
    const firstChest = String(first.chest || '').match(/\d+/)
    const secondChest = String(second.chest || '').match(/\d+/)
    const chestDifference = (firstChest ? Number(firstChest[0]) : Number.POSITIVE_INFINITY) - (secondChest ? Number(secondChest[0]) : Number.POSITIVE_INFINITY)
    return chestDifference || first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' })
  })

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
  return res.status(200).json({ guild: guild.name, members })
}
