import { supabase } from './supabaseClient'

export const ctaClassifications = ['Tank', 'Support', 'Healer', 'DPS', 'Caller']
export const ctaAttendanceStatuses = ['signed_up', 'present', 'late', 'absent', 'excused']

function adminName(admin = {}) {
  return admin.username || admin.email || 'Administrator'
}

function randomShareToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toUiSignup(row, memberNames = {}) {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    slotId: row.slot_id,
    memberId: row.member_id,
    memberName: memberNames[row.member_id] || row.member_name || 'Unknown member',
    editCodeHash: row.edit_code_hash,
    attendanceStatus: row.attendance_status || 'signed_up',
    signedUpAt: row.signed_up_at,
    updatedAt: row.updated_at,
  }
}

function toUiSlot(row, signups = []) {
  return {
    id: row.id,
    partyId: row.party_id,
    slotNumber: row.slot_number,
    classification: row.classification || 'DPS',
    roleLabel: row.role_label || 'DPS',
    weapon: row.weapon || '',
    offHand: row.off_hand || '',
    helmet: row.helmet || '',
    armor: row.armor || '',
    boots: row.boots || '',
    cape: row.cape || '',
    food: row.food || '',
    potion: row.potion || '',
    notes: row.notes || '',
    sortOrder: row.sort_order || 0,
    signup: signups.find((signup) => signup.slot_id === row.id) || null,
  }
}

function toUiParty(row, slots = [], signups = []) {
  return {
    id: row.id,
    sheetId: row.sheet_id,
    name: row.name,
    sortOrder: row.sort_order || 0,
    slots: slots.filter((slot) => slot.party_id === row.id).sort((first, second) => (first.sort_order || 0) - (second.sort_order || 0)).map((slot) => toUiSlot(slot, signups)),
  }
}

function toUiSheet(row, parties = [], slots = [], signups = [], memberNames = {}) {
  const sheetParties = parties.filter((party) => party.sheet_id === row.id).sort((first, second) => (first.sort_order || 0) - (second.sort_order || 0)).map((party) => toUiParty(party, slots, signups))
  const flatSlots = sheetParties.flatMap((party) => party.slots)
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    ctaName: row.cta_name,
    startsAt: row.starts_at,
    timezone: row.timezone || 'UTC',
    status: row.status || 'draft',
    disarrayLevel: row.disarray_level ?? '',
    recommendedGroupSize: row.recommended_group_size ?? '',
    createdBy: row.created_by_name || '',
    updatedBy: row.updated_by_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareToken: row.share_token || '',
    parties: sheetParties,
    filledCount: flatSlots.filter((slot) => slot.signup).length,
    slotCount: flatSlots.length,
    memberNames,
  }
}

export async function loadCtaWorkspace(guildId) {
  if (!supabase) throw new Error('Supabase is not configured')
  const [sheetsResult, partiesResult, slotsResult, signupsResult, membersResult, activityResult, templatesResult] = await Promise.all([
    supabase.from('cta_sheets').select('*').eq('guild_id', guildId).neq('status', 'archived').order('starts_at', { ascending: false }),
    supabase.from('cta_parties').select('*').order('sort_order'),
    supabase.from('cta_slots').select('*').order('sort_order'),
    supabase.from('cta_signups').select('*').order('signed_up_at'),
    supabase.from('members').select('id, character_name').eq('guild_id', guildId).eq('active', true).order('character_name'),
    supabase.from('cta_activity').select('*').eq('guild_id', guildId).order('created_at', { ascending: false }).limit(300),
    supabase.from('cta_templates').select('*').eq('guild_id', guildId).order('name'),
  ])
  for (const result of [sheetsResult, partiesResult, slotsResult, signupsResult, membersResult, activityResult, templatesResult]) if (result.error) throw result.error
  const memberNames = Object.fromEntries((membersResult.data || []).map((member) => [member.id, member.character_name]))
  const signups = (signupsResult.data || []).map((signup) => toUiSignup(signup, memberNames))
  return {
    sheets: (sheetsResult.data || []).map((sheet) => toUiSheet(sheet, partiesResult.data || [], slotsResult.data || [], signups, memberNames)),
    members: membersResult.data || [],
    activity: activityResult.data || [],
    templates: templatesResult.data || [],
  }
}

async function logCtaActivity(guildId, sheetId, action, entityType, entityId, details, admin = {}) {
  const { error } = await supabase.from('cta_activity').insert({ guild_id: guildId, sheet_id: sheetId, actor_id: admin.id || null, actor_name: adminName(admin), action, entity_type: entityType, entity_id: entityId || null, details: details || {} })
  if (error) throw error
}

export async function createCtaSheet(guildId, draft, admin = {}) {
  const shareToken = randomShareToken()
  const { data: sheet, error } = await supabase.from('cta_sheets').insert({ guild_id: guildId, name: draft.name, cta_name: draft.ctaName, starts_at: draft.startsAt, timezone: 'UTC', status: draft.status || 'open', disarray_level: draft.disarrayLevel === '' ? null : Number(draft.disarrayLevel || 0), recommended_group_size: draft.recommendedGroupSize === '' ? null : Number(draft.recommendedGroupSize || 0), share_token_hash: await hashToken(shareToken), created_by: admin.id || null, created_by_name: adminName(admin), updated_by: admin.id || null, updated_by_name: adminName(admin) }).select('*').single()
  if (error) throw error
  const { data: party, error: partyError } = await supabase.from('cta_parties').insert({ sheet_id: sheet.id, name: draft.initialPartyName || 'Party 1', sort_order: 0 }).select('*').single()
  if (partyError) throw partyError
  await logCtaActivity(guildId, sheet.id, 'Sheet created', 'sheet', sheet.id, { name: sheet.name, ctaName: sheet.cta_name }, admin)
  return { sheet, party, shareToken }
}

export async function updateCtaSheet(guildId, sheetId, changes, admin = {}) {
  const { data, error } = await supabase.from('cta_sheets').update({ name: changes.name, cta_name: changes.ctaName, starts_at: changes.startsAt, status: changes.status, disarray_level: changes.disarrayLevel === '' ? null : Number(changes.disarrayLevel || 0), recommended_group_size: changes.recommendedGroupSize === '' ? null : Number(changes.recommendedGroupSize || 0), updated_by: admin.id || null, updated_by_name: adminName(admin), updated_at: new Date().toISOString() }).eq('id', sheetId).eq('guild_id', guildId).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Sheet updated', 'sheet', sheetId, changes, admin)
  return data
}

export async function duplicateCtaSheet(guildId, source, admin = {}) {
  const created = await createCtaSheet(guildId, { name: `${source.name} copy`, ctaName: source.ctaName, startsAt: source.startsAt, status: 'draft', disarrayLevel: source.disarrayLevel, recommendedGroupSize: source.recommendedGroupSize, initialPartyName: source.parties[0]?.name || 'Party 1' }, admin)
  const firstPartyId = created.party.id
  for (const [partyIndex, party] of source.parties.entries()) {
    const targetParty = partyIndex === 0 ? created.party : await addCtaParty(guildId, created.sheet.id, party.name, admin)
    if (partyIndex === 0 && party.name !== created.party.name) await updateCtaParty(guildId, created.sheet.id, firstPartyId, party.name, admin)
    for (const slot of party.slots) await addCtaSlot(guildId, created.sheet.id, targetParty.id, slot, admin)
  }
  await logCtaActivity(guildId, created.sheet.id, 'Sheet duplicated', 'sheet', created.sheet.id, { sourceSheetId: source.id }, admin)
  return created
}

export async function saveCtaTemplate(guildId, name, description, sheet, admin = {}) {
  const templateData = { parties: sheet.parties.map((party) => ({ name: party.name, slots: party.slots.map(({ signup, id, partyId, ...slot }) => slot) })) }
  const { data, error } = await supabase.from('cta_templates').insert({ guild_id: guildId, name: name.trim(), description: description || null, template_data: templateData, created_by: admin.id || null, created_by_name: adminName(admin) }).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheet.id, 'Template saved', 'template', data.id, { name: data.name }, admin)
  return data
}

export async function regenerateCtaShareToken(sheetId, accessToken) {
  const response = await fetch('/api/cta-share', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetId }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not create a share link.')
  return result
}

export async function addCtaParty(guildId, sheetId, name, admin = {}) {
  const { count } = await supabase.from('cta_parties').select('id', { count: 'exact', head: true }).eq('sheet_id', sheetId)
  const { data, error } = await supabase.from('cta_parties').insert({ sheet_id: sheetId, name: name.trim(), sort_order: count || 0 }).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Party added', 'party', data.id, { name: data.name }, admin)
  return data
}

export async function updateCtaParty(guildId, sheetId, partyId, name, admin = {}) {
  const { data, error } = await supabase.from('cta_parties').update({ name: name.trim() }).eq('id', partyId).eq('sheet_id', sheetId).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Party renamed', 'party', partyId, { name: data.name }, admin)
  return data
}

export async function deleteCtaParty(guildId, sheetId, partyId, admin = {}) {
  const { error } = await supabase.from('cta_parties').delete().eq('id', partyId).eq('sheet_id', sheetId)
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Party removed', 'party', partyId, {}, admin)
}

export async function addCtaSlot(guildId, sheetId, partyId, draft, admin = {}) {
  const { count } = await supabase.from('cta_slots').select('id', { count: 'exact', head: true }).eq('party_id', partyId)
  const { data, error } = await supabase.from('cta_slots').insert({ party_id: partyId, slot_number: Number(draft.slotNumber || (count || 0) + 1), classification: draft.classification || 'DPS', role_label: draft.roleLabel || draft.classification || 'DPS', weapon: draft.weapon || null, off_hand: draft.offHand || null, helmet: draft.helmet || null, armor: draft.armor || null, boots: draft.boots || null, cape: draft.cape || null, food: draft.food || null, potion: draft.potion || null, notes: draft.notes || null, sort_order: count || 0 }).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Slot added', 'slot', data.id, { roleLabel: data.role_label, classification: data.classification }, admin)
  return data
}

export async function updateCtaSlot(guildId, sheetId, slotId, draft, admin = {}) {
  const { data, error } = await supabase.from('cta_slots').update({ slot_number: Number(draft.slotNumber || 1), classification: draft.classification || 'DPS', role_label: draft.roleLabel || draft.classification || 'DPS', weapon: draft.weapon || null, off_hand: draft.offHand || null, helmet: draft.helmet || null, armor: draft.armor || null, boots: draft.boots || null, cape: draft.cape || null, food: draft.food || null, potion: draft.potion || null, notes: draft.notes || null }).eq('id', slotId).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Slot edited', 'slot', slotId, draft, admin)
  return data
}

export async function swapCtaSlots(guildId, sheetId, firstSlot, secondSlot, admin = {}) {
  const firstUpdate = supabase.from('cta_slots').update({ slot_number: Number(secondSlot.slotNumber || 1), sort_order: Number(secondSlot.sortOrder || 0) }).eq('id', firstSlot.id).select('*').single()
  const secondUpdate = supabase.from('cta_slots').update({ slot_number: Number(firstSlot.slotNumber || 1), sort_order: Number(firstSlot.sortOrder || 0) }).eq('id', secondSlot.id).select('*').single()
  const [firstResult, secondResult] = await Promise.all([firstUpdate, secondUpdate])
  if (firstResult.error) throw firstResult.error
  if (secondResult.error) throw secondResult.error
  await logCtaActivity(guildId, sheetId, 'Slots reordered', 'slot', firstSlot.id, { firstSlotId: firstSlot.id, secondSlotId: secondSlot.id, firstSlotNumber: firstSlot.slotNumber, secondSlotNumber: secondSlot.slotNumber }, admin)
  return [firstResult.data, secondResult.data]
}

export async function duplicateCtaSlot(guildId, sheetId, sourceSlot, admin = {}) {
  const { data: siblings, error: siblingError } = await supabase.from('cta_slots').select('slot_number, sort_order').eq('party_id', sourceSlot.partyId)
  if (siblingError) throw siblingError
  const nextSlotNumber = Math.max(0, ...(siblings || []).map((slot) => Number(slot.slot_number) || 0)) + 1
  const nextSortOrder = Math.max(-1, ...(siblings || []).map((slot) => Number(slot.sort_order) || 0)) + 1
  const { data, error } = await supabase.from('cta_slots').insert({ party_id: sourceSlot.partyId, slot_number: nextSlotNumber, classification: sourceSlot.classification || 'DPS', role_label: sourceSlot.roleLabel || sourceSlot.classification || 'DPS', weapon: sourceSlot.weapon || null, off_hand: sourceSlot.offHand || null, helmet: sourceSlot.helmet || null, armor: sourceSlot.armor || null, boots: sourceSlot.boots || null, cape: sourceSlot.cape || null, food: sourceSlot.food || null, potion: sourceSlot.potion || null, notes: sourceSlot.notes || null, sort_order: nextSortOrder }).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Slot duplicated', 'slot', data.id, { sourceSlotId: sourceSlot.id, sourceSlotNumber: sourceSlot.slotNumber, newSlotNumber: data.slot_number }, admin)
  return data
}

export async function deleteCtaSlot(guildId, sheetId, slotId, admin = {}) {
  const { error } = await supabase.from('cta_slots').delete().eq('id', slotId)
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Slot removed', 'slot', slotId, {}, admin)
}

export async function updateCtaSignup(guildId, sheetId, signupId, changes, admin = {}) {
  const { data, error } = await supabase.from('cta_signups').update({ slot_id: changes.slotId, attendance_status: changes.attendanceStatus }).eq('id', signupId).eq('sheet_id', sheetId).select('*').single()
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Signup updated', 'signup', signupId, changes, admin)
  return data
}

export async function deleteCtaSignup(guildId, sheetId, signupId, admin = {}) {
  const { error } = await supabase.from('cta_signups').delete().eq('id', signupId).eq('sheet_id', sheetId)
  if (error) throw error
  await logCtaActivity(guildId, sheetId, 'Signup removed by administrator', 'signup', signupId, {}, admin)
}

export async function loadPublicCtaSheet(token) {
  const response = await fetch(`/api/cta-sheet?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not load this CTA sheet.')
  return result
}

export async function submitPublicCtaAction(token, payload) {
  const response = await fetch(`/api/cta-sheet?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not update this CTA sheet.')
  return result
}
