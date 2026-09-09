import { supabase } from './supabaseClient'

const tones = ['violet', 'blue', 'green', 'orange', 'rose', 'teal']

function toneFor(name = '') {
  return tones[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length]
}

function displayDate(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) + ' UTC'
}

function latestRequestFor(memberId, requests) {
  return requests.find((request) => request.member_id === memberId)
}

export function toUiMember(row, requests = [], guildName = 'Coup De Grace') {
  const request = latestRequestFor(row.id, requests)
  const open = request && request.status !== 'regeared'
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
    regearItems: [request?.weapon, request?.off_hand, request?.helmet, request?.armor, request?.boots].filter(Boolean),
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

export function toUiRequest(row, members = []) {
  const member = members.find((entry) => entry.id === row.member_id)
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: member?.character_name || 'Unknown member',
    role: row.role,
    reportedBy: row.reported_by_name || '',
    diedAt: row.died_at || row.created_at,
    deathNote: row.death_note || '',
    chest: row.issue_chest || 'Unassigned',
    status: row.status,
    weapon: row.weapon,
    offHand: row.off_hand,
    helmet: row.helmet,
    armor: row.armor,
    boots: row.boots,
    silverCost: row.silver_cost || 0,
    regearedAt: row.regeared_at,
    regearedBy: row.regeared_by_name || '',
  }
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

  const [membersResult, itemsResult, requestsResult, plansResult] = await Promise.all([
    supabase.from('members').select('*').eq('guild_id', guild.id).eq('active', true).order('character_name'),
    supabase.from('items').select('*, chests(label)').eq('guild_id', guild.id).order('name'),
    supabase.from('regear_requests').select('*').eq('guild_id', guild.id).order('created_at', { ascending: false }),
    supabase.from('regear_plans').select('*').eq('guild_id', guild.id).order('starts_at'),
  ])
  if (membersResult.error) throw membersResult.error
  if (itemsResult.error) throw itemsResult.error
  if (requestsResult.error) throw requestsResult.error
  if (plansResult.error) throw plansResult.error

  return {
    guild,
    members: membersResult.data.map((row) => toUiMember(row, requestsResult.data, guild.name)),
    items: itemsResult.data.map(toUiItem),
    plans: plansResult.data.map((row) => toUiPlan(row, requestsResult.data)),
    requests: requestsResult.data.map((row) => toUiRequest(row, membersResult.data)),
  }
}

async function chestIdFor(guildId, label) {
  const cleanLabel = label?.trim()
  if (!cleanLabel || cleanLabel.toLowerCase() === 'unassigned') return null
  const { data: existing, error: findError } = await supabase
    .from('chests')
    .select('id')
    .eq('guild_id', guildId)
    .eq('label', cleanLabel)
    .maybeSingle()
  if (findError) throw findError
  if (existing) return existing.id
  const { data: created, error: createError } = await supabase
    .from('chests')
    .insert({ guild_id: guildId, label: cleanLabel })
    .select('id')
    .single()
  if (createError) throw createError
  return created.id
}

export async function insertMember(guildId, member) {
  const { data, error } = await supabase.from('members').insert({
    guild_id: guildId,
    character_name: member.name,
    issue_chest: member.chest || 'Unassigned',
    notes: member.notes || null,
  }).select('*').single()
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
  const { data, error } = await supabase.from('items').insert({
    guild_id: guildId,
    name: item.name,
    category: item.category,
    tier: item.tier || 'Unspecified',
    quantity: Number(item.quantity || 0),
    minimum_quantity: Number(item.minimumQuantity || 0),
  }).select('*, chests(label)').single()
  if (error) throw error
  return toUiItem(data)
}

export async function updateItem(guildId, itemId, item) {
  const { data, error } = await supabase.from('items').update({
    name: item.name,
    category: item.category,
    tier: item.tier || 'Unspecified',
    quantity: Number(item.quantity || 0),
    minimum_quantity: Number(item.minimumQuantity || 0),
  }).eq('id', itemId).eq('guild_id', guildId).select('*, chests(label)').single()
  if (error) throw error
  return toUiItem(data)
}

export async function deleteItem(guildId, itemId) {
  const { error } = await supabase.from('items').delete().eq('id', itemId).eq('guild_id', guildId)
  if (error) throw error
}

function itemSlots(items = []) {
  const slots = { weapon: null, off_hand: null, helmet: null, armor: null, boots: null }
  items.forEach((item) => {
    const category = item.category?.toLowerCase()
    const slot = category === 'head' ? 'helmet' : category === 'off hand' ? 'off_hand' : category
    if (slot in slots && !slots[slot]) slots[slot] = item.name
  })
  return slots
}

export async function insertRegearRequest(guildId, request) {
  const slots = itemSlots(request.items)
  const { data, error } = await supabase.from('regear_requests').insert({
    guild_id: guildId,
    member_id: request.memberId,
    reported_by: request.reportedBy || null,
    reported_by_name: request.reportedByName || null,
    role: request.role,
    death_note: request.note,
    issue_chest: request.chest || 'Unassigned',
    died_at: request.diedAt || new Date().toISOString(),
    chest_id: await chestIdFor(guildId, request.chest),
    ...slots,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function markRequestRegeared(guildId, requestId, admin = {}) {
  const regearedAt = new Date().toISOString()
  const adminName = admin.username || admin.email || 'Administrator'
  const { error } = await supabase.from('regear_requests').update({
    status: 'regeared',
    regeared_at: regearedAt,
    issued_by: admin.id || null,
    regeared_by: admin.id || null,
    regeared_by_name: adminName,
  }).eq('id', requestId).eq('guild_id', guildId)
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
  const { data, error } = await supabase
    .from('admin_invites')
    .select('id, email, created_at, expires_at, accepted_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function insertPlan(guildId, plan) {
  const { data, error } = await supabase.from('regear_plans').insert({
    guild_id: guildId,
    title: plan.name,
    starts_at: plan.startsAt || new Date().toISOString(),
    status: 'upcoming',
    notes: plan.budget ? `${plan.budget} silver budget` : null,
  }).select('*').single()
  if (error) throw error
  return toUiPlan(data)
}
