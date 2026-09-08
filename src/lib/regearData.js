import { supabase } from './supabaseClient'

const tones = ['violet', 'blue', 'green', 'orange', 'rose', 'teal']

function toneFor(name = '') {
  return tones[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length]
}

function displayDate(value) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
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
    status: open ? 'Open regear' : 'Ready',
    chest: row.issue_chest || 'Unassigned',
    last: request ? displayDate(request.regeared_at || request.created_at) : 'Not yet',
    issuedBy: request?.issued_by ? 'Administrator' : 'Pending',
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
    chest: row.chests?.label || 'Unassigned',
    stock: `${quantity} / ${minimum}`,
    quantity,
    minimumQuantity: minimum,
    percentage,
    tone: percentage >= 75 ? 'good' : percentage >= 40 ? 'warn' : 'low',
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

  const [membersResult, itemsResult, requestsResult] = await Promise.all([
    supabase.from('members').select('*').eq('guild_id', guild.id).eq('active', true).order('character_name'),
    supabase.from('items').select('*, chests(label)').eq('guild_id', guild.id).order('name'),
    supabase.from('regear_requests').select('*').eq('guild_id', guild.id).order('created_at', { ascending: false }),
  ])
  if (membersResult.error) throw membersResult.error
  if (itemsResult.error) throw itemsResult.error
  if (requestsResult.error) throw requestsResult.error

  return {
    guild,
    members: membersResult.data.map((row) => toUiMember(row, requestsResult.data, guild.name)),
    items: itemsResult.data.map(toUiItem),
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
    role: member.role,
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

export async function insertItem(guildId, item) {
  const { data, error } = await supabase.from('items').insert({
    guild_id: guildId,
    name: item.name,
    category: item.category,
    chest_id: await chestIdFor(guildId, item.chest),
    quantity: Number(item.quantity || 0),
    minimum_quantity: Number(item.minimumQuantity || 0),
  }).select('*, chests(label)').single()
  if (error) throw error
  return toUiItem(data)
}

export async function updateItemChest(guildId, itemId, chest) {
  const { error } = await supabase.from('items').update({ chest_id: await chestIdFor(guildId, chest) }).eq('id', itemId).eq('guild_id', guildId)
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
    role: request.role,
    death_note: request.note,
    issue_chest: request.chest || 'Unassigned',
    chest_id: await chestIdFor(guildId, request.chest),
    ...slots,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function markRequestRegeared(guildId, requestId) {
  const { error } = await supabase.from('regear_requests').update({
    status: 'regeared',
    regeared_at: new Date().toISOString(),
  }).eq('id', requestId).eq('guild_id', guildId)
  if (error) throw error
}
