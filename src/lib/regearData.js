import { supabase } from './supabaseClient'

const tones = ['violet', 'blue', 'green', 'orange', 'rose', 'teal']

function toneFor(name = '') {
  return tones[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length]
}

function displayDate(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) + ' UTC'
}

function utcDayKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-')
}

function latestRequestFor(memberId, requests) {
  return requests.find((request) => request.member_id === memberId && request.status !== 'archived') || requests.find((request) => request.member_id === memberId)
}

function legacyItemsFromRow(row = {}) {
  return [
    ['Weapon', row.weapon],
    ['Off hand', row.off_hand],
    ['Head', row.helmet],
    ['Armor', row.armor],
    ['Boots', row.boots],
  ].filter(([, name]) => name).map(([category, name], index) => ({ id: `legacy-${row.id}-${index}`, category, name, quantity: 1, sortOrder: index }))
}

export function toUiMember(row, requests = [], guildName = 'Coup De Grace') {
  const request = latestRequestFor(row.id, requests)
  const requestStatus = request?.status === 'archived' ? request.archived_from_status || 'open' : request?.status
  const open = request && requestStatus !== 'regeared'
  return {
    id: row.id,
    name: row.character_name,
    role: row.role,
    guild: guildName,
    avatar: row.character_name?.[0]?.toUpperCase() || '?',
    tone: toneFor(row.character_name),
    status: open ? 'Open regear' : 'No open request',
    chest: row.issue_chest || 'Unassigned',
    last: request ? displayDate(request.regeared_at || request.created_at) : 'Not yet',
    issuedBy: request?.regeared_by_name || (request?.issued_by ? 'Administrator' : 'Pending'),
    deathNote: request?.death_note || '',
    regearRole: request?.role,
    regearItems: legacyItemsFromRow(request).map((item) => item.name),
    requestId: request?.id,
  }
}

export function toUiItem(row) {
  const quantity = Number(row.quantity || 0)
  const minimum = Number(row.minimum_quantity || 0)
  const target = Math.max(quantity, minimum, 1)
  const percentage = Math.min(100, Math.round((quantity / target) * 100))
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    tier: row.tier || 'Unspecified',
    chest: row.chests?.label || 'Unassigned',
    stock: `${quantity} / ${minimum}`,
    quantity,
    minimumQuantity: minimum,
    percentage,
    tone: percentage >= 75 ? 'good' : percentage >= 40 ? 'warn' : 'low',
  }
}

export function toUiPlan(row, requests = []) {
  const planRequests = requests.filter((request) => request.cta_plan_id === row.id)
  const closed = planRequests.filter((request) => request.status === 'regeared').length
  const date = new Date(row.starts_at)
  return {
    id: row.id,
    title: row.title,
    subtitle: `${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(date)} UTC`,
    status: row.status === 'in_progress' ? 'In progress' : row.status === 'complete' ? 'Complete' : 'Upcoming',
    progress: `${planRequests.length} deaths · ${closed} closed`,
    cost: row.notes || 'No budget set',
    date: `${new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date).toUpperCase()}`,
    accent: row.status === 'complete' ? 'green' : row.status === 'in_progress' ? 'blue' : 'ember',
  }
}

export function toUiEvent(row) {
  return {
    id: row.id,
    date: row.event_date,
    time: row.event_time || '',
    name: row.name,
    notes: row.notes || '',
    createdBy: row.created_by_name || '',
    updatedBy: row.updated_by_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toUiRequest(row, members = [], notifications = [], childItems = [], events = []) {
  const member = members.find((entry) => entry.id === row.member_id)
  const event = events.find((entry) => entry.id === row.event_id)
  const requestItems = childItems
    .filter((entry) => entry.regear_request_id === row.id)
    .sort((first, second) => (first.sort_order || 0) - (second.sort_order || 0))
    .map((entry) => ({ id: entry.id, category: entry.category, name: entry.item_name, quantity: Number(entry.quantity || 1), sortOrder: entry.sort_order || 0 }))
  const items = requestItems.length ? requestItems : legacyItemsFromRow(row)
  const activity = notifications
    .filter((entry) => entry.entity_id === row.id)
    .sort((first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime())
    .map((entry) => ({ id: entry.id, action: entry.title || 'Regear updated', adminName: entry.actor_name || 'Unknown admin', at: entry.created_at }))
  const createdActivity = activity.find((entry) => entry.action === 'New regear reported')
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: member?.character_name || 'Unknown member',
    role: row.role,
    reportedBy: row.reported_by_name || createdActivity?.adminName || '',
    diedAt: row.died_at || row.created_at,
    deathNote: row.death_note || '',
    chest: row.issue_chest || 'Unassigned',
    eventId: row.event_id || null,
    eventName: event?.name || row.event_name || 'Unassigned event',
    eventDate: event?.event_date || utcDayKey(row.died_at || row.created_at),
    eventTime: event?.event_time || '',
    // Older records may still carry the retired archive status. Show them
    // using their previous workflow status now that date-level deletion is used.
    status: row.status === 'archived' ? row.archived_from_status || 'open' : row.status,
    items,
    weapon: row.weapon,
    offHand: row.off_hand,
    helmet: row.helmet,
    armor: row.armor,
    boots: row.boots,
    silverCost: row.silver_cost || 0,
    regearedAt: row.regeared_at,
    regearedBy: row.regeared_by_name || '',
    archivedAt: row.archived_at,
    archivedBy: row.archived_by_name || '',
    archivedFromStatus: row.archived_from_status || 'open',
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_name || '',
    activity,
  }
}

function missingOptionalTable(error) {
  return error && (error.code === '42P01' || error.code === 'PGRST205' || String(error.message || '').toLowerCase().includes('schema cache'))
}

export async function loadWorkspace() {
  if (!supabase) throw new Error('Supabase is not configured')

  const { data: guild, error: guildError } = await supabase
    .from('guilds')
    .select('id, name, region, public_slug')
    .eq('public_slug', 'coup-de-grace')
    .maybeSingle()
  if (guildError) throw guildError
  if (!guild) throw new Error('Coup De Grace was not found or this account is not linked as an admin yet.')

  const [membersResult, itemsResult, requestsResult, plansResult, notificationsResult, eventsResult, requestItemsResult] = await Promise.all([
    supabase.from('members').select('*').eq('guild_id', guild.id).eq('active', true).order('character_name'),
    supabase.from('items').select('*, chests(label)').eq('guild_id', guild.id).order('name'),
    supabase.from('regear_requests').select('*').eq('guild_id', guild.id).order('created_at', { ascending: false }),
    supabase.from('regear_plans').select('*').eq('guild_id', guild.id).order('starts_at'),
    supabase.from('admin_notifications').select('id, type, title, actor_name, entity_id, created_at').eq('guild_id', guild.id).eq('type', 'regear').order('created_at', { ascending: true }),
    supabase.from('regear_events').select('*').eq('guild_id', guild.id).order('event_date', { ascending: false }).order('name'),
    supabase.from('regear_request_items').select('*').order('sort_order'),
  ])
  if (membersResult.error) throw membersResult.error
  if (itemsResult.error) throw itemsResult.error
  if (requestsResult.error) throw requestsResult.error
  if (plansResult.error) throw plansResult.error

  const eventRows = eventsResult.error && !missingOptionalTable(eventsResult.error) ? (() => { throw eventsResult.error })() : (eventsResult.data || [])
  const requestItemRows = requestItemsResult.error && !missingOptionalTable(requestItemsResult.error) ? (() => { throw requestItemsResult.error })() : (requestItemsResult.data || [])
  const notifications = notificationsResult.error ? [] : (notificationsResult.data || [])
  return {
    guild,
    members: membersResult.data.map((row) => toUiMember(row, requestsResult.data, guild.name)),
    items: itemsResult.data.map(toUiItem),
    plans: plansResult.data.map((row) => toUiPlan(row, requestsResult.data)),
    events: eventRows.map(toUiEvent),
    requests: requestsResult.data.map((row) => toUiRequest(row, membersResult.data, notifications, requestItemRows, eventRows)),
  }
}

async function chestIdFor(guildId, label) {
  const cleanLabel = label?.trim()
  if (!cleanLabel || cleanLabel.toLowerCase() === 'unassigned') return null
  const { data: existing, error: findError } = await supabase.from('chests').select('id').eq('guild_id', guildId).eq('label', cleanLabel).maybeSingle()
  if (findError) throw findError
  if (existing) return existing.id
  const { data: created, error: createError } = await supabase.from('chests').insert({ guild_id: guildId, label: cleanLabel }).select('id').single()
  if (createError) throw createError
  return created.id
}

export async function insertMember(guildId, member) {
  const { data, error } = await supabase.from('members').insert({ guild_id: guildId, character_name: member.name, issue_chest: member.chest || 'Unassigned', notes: member.notes || null }).select('*').single()
  if (error) throw error
  return toUiMember(data)
}

export async function updateMemberChest(guildId, memberId, chest) {
  const { error } = await supabase.from('members').update({ issue_chest: chest }).eq('id', memberId).eq('guild_id', guildId)
  if (error) throw error
}

export async function deactivateMember(guildId, memberId) {
  const { error } = await supabase.from('members').update({ active: false }).eq('id', memberId).eq('guild_id', guildId)
  if (error) throw error
}

export async function insertItem(guildId, item) {
  const { data, error } = await supabase.from('items').insert({ guild_id: guildId, name: item.name, category: item.category, tier: item.tier || 'Unspecified', quantity: Number(item.quantity || 0), minimum_quantity: Number(item.minimumQuantity || 0) }).select('*, chests(label)').single()
  if (error) throw error
  return toUiItem(data)
}

export async function updateItem(guildId, itemId, item) {
  const { data, error } = await supabase.from('items').update({ name: item.name, category: item.category, tier: item.tier || 'Unspecified', quantity: Number(item.quantity || 0), minimum_quantity: Number(item.minimumQuantity || 0) }).eq('id', itemId).eq('guild_id', guildId).select('*, chests(label)').single()
  if (error) throw error
  return toUiItem(data)
}

export async function deleteItem(guildId, itemId) {
  const { error } = await supabase.from('items').delete().eq('id', itemId).eq('guild_id', guildId)
  if (error) throw error
}

function normalizeCategory(category = 'Custom') {
  const lower = category.toLowerCase()
  if (['headgear', 'helmet', 'head'].includes(lower)) return 'Head'
  if (['off-hand', 'offhand', 'off hand'].includes(lower)) return 'Off hand'
  if (['weapon', 'armor', 'boots'].includes(lower)) return category[0].toUpperCase() + category.slice(1).toLowerCase()
  return 'Custom'
}

function normalizeRequestItems(items = []) {
  return items.map((item, index) => typeof item === 'string'
    ? { name: item.trim(), category: 'Custom', quantity: 1, sortOrder: index }
    : { ...item, name: String(item.name || '').trim(), category: normalizeCategory(item.category), quantity: Math.max(1, Number(item.quantity) || 1), sortOrder: item.sortOrder ?? index })
    .filter((item) => item.name)
}

function itemSlots(items = []) {
  const slots = { weapon: null, off_hand: null, helmet: null, armor: null, boots: null }
  normalizeRequestItems(items).forEach((item) => {
    const slot = item.category === 'Head' ? 'helmet' : item.category === 'Off hand' ? 'off_hand' : item.category.toLowerCase()
    if (slot in slots && !slots[slot]) slots[slot] = item.name
  })
  return slots
}

async function saveRequestItems(requestId, items) {
  const { error: deleteError } = await supabase.from('regear_request_items').delete().eq('regear_request_id', requestId)
  if (deleteError) throw deleteError
  const rows = normalizeRequestItems(items).map((item) => ({ regear_request_id: requestId, category: item.category, item_name: item.name, quantity: item.quantity, sort_order: item.sortOrder }))
  if (!rows.length) return
  const { error } = await supabase.from('regear_request_items').insert(rows)
  if (error) throw error
}

export async function ensureRegearEvent(guildId, event, admin = {}) {
  const eventDate = event.date || event.eventDate || utcDayKey(new Date())
  const name = String(event.name || 'Unassigned event').trim() || 'Unassigned event'
  const { data: events, error: existingError } = await supabase.from('regear_events').select('*').eq('guild_id', guildId).eq('event_date', eventDate)
  if (existingError) throw existingError
  const existing = (events || []).find((entry) => entry.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing
  const { data, error } = await supabase.from('regear_events').insert({ guild_id: guildId, event_date: eventDate, event_time: event.time || event.eventTime || null, name, notes: event.notes || null, created_by: admin.id || null, created_by_name: admin.username || admin.email || 'Administrator' }).select('*').single()
  if (error) {
    if (error.code === '23505') {
      const { data: duplicate } = await supabase.from('regear_events').select('*').eq('guild_id', guildId).eq('event_date', eventDate).eq('name', name).maybeSingle()
      if (duplicate) return duplicate
    }
    throw error
  }
  return data
}

export async function createRegearEvent(guildId, event, admin = {}) {
  return ensureRegearEvent(guildId, event, admin)
}

export async function updateRegearEvent(guildId, eventId, event, admin = {}) {
  const { data, error } = await supabase.from('regear_events').update({ event_date: event.date, event_time: event.time || event.eventTime || null, name: String(event.name || '').trim() || 'Unassigned event', notes: event.notes || null, updated_by: admin.id || null, updated_by_name: admin.username || admin.email || 'Administrator', updated_at: new Date().toISOString() }).eq('id', eventId).eq('guild_id', guildId).select('*').single()
  if (error) throw error
  return data
}

export async function deleteRegearEvent(guildId, eventId) {
  const { data: requestRows, error: requestError } = await supabase
    .from('regear_requests')
    .select('id')
    .eq('guild_id', guildId)
    .eq('event_id', eventId)
  if (requestError) throw requestError

  const requestIds = (requestRows || []).map((request) => request.id)
  if (requestIds.length) {
    const { error } = await supabase.from('regear_requests').delete().in('id', requestIds).eq('guild_id', guildId)
    if (error) throw error
  }
  const { error } = await supabase.from('regear_events').delete().eq('id', eventId).eq('guild_id', guildId)
  if (error) throw error
  return { requestIds, eventId }
}

export async function deleteRegearDate(guildId, date) {
  const { data: eventRows, error: eventError } = await supabase
    .from('regear_events')
    .select('id, event_date')
    .eq('guild_id', guildId)
    .eq('event_date', date)
  if (eventError) throw eventError

  const eventIds = (eventRows || []).map((event) => event.id)
  const { data: requestRows, error: requestError } = await supabase
    .from('regear_requests')
    .select('id, event_id, died_at, created_at')
    .eq('guild_id', guildId)
  if (requestError) throw requestError

  const requestIds = (requestRows || [])
    .filter((request) => eventIds.includes(request.event_id) || utcDayKey(request.died_at || request.created_at) === date)
    .map((request) => request.id)

  if (requestIds.length) {
    const { error } = await supabase.from('regear_requests').delete().in('id', requestIds).eq('guild_id', guildId)
    if (error) throw error
  }
  if (eventIds.length) {
    const { error } = await supabase.from('regear_events').delete().in('id', eventIds).eq('guild_id', guildId)
    if (error) throw error
  }
  const { error: auditError } = await supabase.rpc('record_regear_date_deleted', {
    target_guild_id: guildId,
    target_date: date,
    deleted_record_count: requestIds.length,
  })
  if (auditError) console.warn('The date was deleted, but its audit notification could not be recorded.', auditError)
  return { requestIds, eventIds }
}

export async function insertRegearRequest(guildId, request) {
  const diedAt = request.diedAt || new Date().toISOString()
  const event = request.eventId ? null : await ensureRegearEvent(guildId, { date: request.eventDate || utcDayKey(diedAt), name: request.eventName }, { id: request.reportedBy, username: request.reportedByName })
  const items = normalizeRequestItems(request.items)
  const slots = itemSlots(items)
  const { data, error } = await supabase.from('regear_requests').insert({ guild_id: guildId, member_id: request.memberId, event_id: request.eventId || event?.id || null, reported_by: request.reportedBy || null, reported_by_name: request.reportedByName || null, role: request.role, death_note: request.note, issue_chest: request.chest || 'Unassigned', died_at: diedAt, chest_id: await chestIdFor(guildId, request.chest), ...slots }).select('*').single()
  if (error) throw error
  await saveRequestItems(data.id, items)
  return { ...data, event, items }
}

export async function updateRegearRequest(guildId, requestId, request, admin = {}) {
  const event = request.eventId ? null : await ensureRegearEvent(guildId, { date: request.eventDate || utcDayKey(request.diedAt), name: request.eventName }, admin)
  const items = normalizeRequestItems(request.items)
  const slots = itemSlots(items)
  const { data, error } = await supabase.from('regear_requests').update({ event_id: request.eventId || event?.id || null, role: request.role, death_note: request.note, issue_chest: request.chest || 'Unassigned', died_at: request.diedAt, chest_id: await chestIdFor(guildId, request.chest), updated_by: admin.id || null, updated_by_name: admin.username || admin.email || 'Administrator', updated_at: new Date().toISOString(), ...slots }).eq('id', requestId).eq('guild_id', guildId).select('*').single()
  if (error) throw error
  await saveRequestItems(requestId, items)
  return { ...data, event, items }
}

export async function markRequestRegeared(guildId, requestId, admin = {}) {
  const regearedAt = new Date().toISOString()
  const adminName = admin.username || admin.email || 'Administrator'
  const { error } = await supabase.from('regear_requests').update({ status: 'regeared', regeared_at: regearedAt, issued_by: admin.id || null, regeared_by: admin.id || null, regeared_by_name: adminName, updated_by: admin.id || null, updated_by_name: adminName, updated_at: regearedAt }).eq('id', requestId).eq('guild_id', guildId).eq('status', 'open')
  if (error) throw error
  return { regearedAt, regearedBy: adminName }
}

export async function listAdminInvites(guildId, accessToken) {
  if (accessToken) {
    const response = await fetch('/api/admin-invites', { headers: { Authorization: `Bearer ${accessToken}` } })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Could not load invitations.')
    return result.invites || []
  }
  const { data, error } = await supabase.from('admin_invites').select('id, email, created_at, expires_at, accepted_at').eq('guild_id', guildId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function insertPlan(guildId, plan) {
  const { data, error } = await supabase.from('regear_plans').insert({ guild_id: guildId, title: plan.name, starts_at: plan.startsAt || new Date().toISOString(), status: 'upcoming', notes: plan.budget ? `${plan.budget} silver budget` : null }).select('*').single()
  if (error) throw error
  return toUiPlan(data)
}
