import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  return res.status(status).json(body)
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function makeEditCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase()
}

function hashEditCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex')
}

function sheetPayload(sheet, parties, slots, signups, members, activity = []) {
  const memberMap = new Map((members || []).map((member) => [member.id, member.character_name]))
  const signupMap = new Map((signups || []).map((signup) => [signup.slot_id, { id: signup.id, sheetId: signup.sheet_id, slotId: signup.slot_id, memberId: signup.member_id, memberName: memberMap.get(signup.member_id) || 'Unknown member', attendanceStatus: signup.attendance_status, signedUpAt: signup.signed_up_at, updatedAt: signup.updated_at }]))
  const partyPayload = (parties || []).sort((a, b) => a.sort_order - b.sort_order).map((party) => ({
    id: party.id,
    name: party.name,
    sortOrder: party.sort_order,
    slots: (slots || []).filter((slot) => slot.party_id === party.id).sort((a, b) => a.sort_order - b.sort_order).map((slot) => ({
      id: slot.id,
      partyId: slot.party_id,
      slotNumber: slot.slot_number,
      classification: slot.classification,
      roleLabel: slot.role_label,
      weapon: slot.weapon || '',
      offHand: slot.off_hand || '',
      helmet: slot.helmet || '',
      armor: slot.armor || '',
      boots: slot.boots || '',
      cape: slot.cape || '',
      food: slot.food || '',
      potion: slot.potion || '',
      notes: slot.notes || '',
      signup: signupMap.get(slot.id) || null,
    })),
  }))
  const publicMembers = (members || []).map((member) => ({ id: member.id, name: member.character_name }))
  return {
    id: sheet.id,
    name: sheet.name,
    ctaName: sheet.cta_name,
    startsAt: sheet.starts_at,
    timezone: sheet.timezone || 'UTC',
    status: sheet.status,
    disarrayLevel: sheet.disarray_level,
    recommendedGroupSize: sheet.recommended_group_size,
    parties: partyPayload,
    members: publicMembers,
    activity: activity.map((entry) => ({ id: entry.id, action: entry.action, actorName: entry.actor_name, createdAt: entry.created_at, details: entry.details })),
  }
}

async function findSheet(admin, token) {
  const { data: sheet, error } = await admin.from('cta_sheets').select('*').eq('share_token_hash', tokenHash(token)).neq('status', 'archived').maybeSingle()
  if (error) throw error
  return sheet
}

async function loadSheet(admin, sheet) {
  const parties = await partyIds(admin, sheet.id)
  const slotsQuery = parties.length
    ? admin.from('cta_slots').select('*').in('party_id', parties).order('sort_order')
    : Promise.resolve({ data: [], error: null })
  const [partiesResult, slotsResult, signupsResult, membersResult, activityResult] = await Promise.all([
    admin.from('cta_parties').select('*').eq('sheet_id', sheet.id).order('sort_order'),
    slotsQuery,
    admin.from('cta_signups').select('*').eq('sheet_id', sheet.id),
    admin.from('members').select('id, character_name').eq('guild_id', sheet.guild_id).eq('active', true).order('character_name'),
    admin.from('cta_activity').select('id, action, actor_name, created_at, details').eq('sheet_id', sheet.id).order('created_at', { ascending: false }).limit(100),
  ])
  for (const result of [partiesResult, slotsResult, signupsResult, membersResult, activityResult]) if (result.error) throw result.error
  return sheetPayload(sheet, partiesResult.data, slotsResult.data, signupsResult.data, membersResult.data, activityResult.data)
}

async function partyIds(admin, sheetId) {
  const { data, error } = await admin.from('cta_parties').select('id').eq('sheet_id', sheetId)
  if (error) throw error
  return (data || []).map((party) => party.id)
}

async function recordActivity(admin, sheet, action, actorName, entityType, entityId, details = {}) {
  await admin.from('cta_activity').insert({ guild_id: sheet.guild_id, sheet_id: sheet.id, actor_name: actorName, action, entity_type: entityType, entity_id: entityId || null, details })
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { error: 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' })
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const token = String(req.query?.token || '')
  if (!token) return json(res, 400, { error: 'A CTA share token is required.' })

  try {
    const sheet = await findSheet(admin, token)
    if (!sheet) return json(res, 404, { error: 'This CTA sheet link is invalid or no longer available.' })

    if (req.method === 'GET') {
      const payload = await loadSheet(admin, sheet)
      res.setHeader('Cache-Control', 'no-store')
      return json(res, 200, payload)
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    if (sheet.status === 'locked') return json(res, 423, { error: 'This CTA sheet is locked. New signups are closed.' })
    const action = body.action

    if (action === 'claim') {
      const { data: member, error: memberError } = await admin.from('members').select('id, character_name').eq('id', body.memberId).eq('guild_id', sheet.guild_id).eq('active', true).maybeSingle()
      if (memberError) throw memberError
      if (!member) return json(res, 400, { error: 'That registered IGN is not available.' })
      const { data: slot, error: slotError } = await admin.from('cta_slots').select('id, party_id').eq('id', body.slotId).maybeSingle()
      if (slotError) throw slotError
      if (!slot) return json(res, 400, { error: 'That slot no longer exists.' })
      const parties = await partyIds(admin, sheet.id)
      if (!parties.includes(slot.party_id)) return json(res, 400, { error: 'That slot does not belong to this sheet.' })
      const editCode = makeEditCode()
      const { data: signup, error: signupError } = await admin.from('cta_signups').insert({ sheet_id: sheet.id, slot_id: slot.id, member_id: member.id, edit_code_hash: hashEditCode(editCode) }).select('*').single()
      if (signupError) {
        if (signupError.code === '23505') return json(res, 409, { error: 'That slot or member has already been claimed. Refresh the sheet and choose another slot.' })
        throw signupError
      }
      await recordActivity(admin, sheet, 'Member signup added', member.character_name, 'signup', signup.id, { slotId: slot.id })
      return json(res, 200, { editCode, signup: { id: signup.id, slotId: signup.slot_id, memberId: signup.member_id, memberName: member.character_name, attendanceStatus: signup.attendance_status } })
    }

    if (action === 'release' || action === 'move') {
      const { data: signup, error: signupError } = await admin.from('cta_signups').select('*').eq('id', body.signupId).eq('sheet_id', sheet.id).maybeSingle()
      if (signupError) throw signupError
      if (!signup || signup.edit_code_hash !== hashEditCode(body.editCode)) return json(res, 403, { error: 'That private edit code is not valid.' })
      const { data: member, error: memberError } = await admin.from('members').select('character_name').eq('id', signup.member_id).maybeSingle()
      if (memberError) throw memberError
      if (action === 'release') {
        const { error } = await admin.from('cta_signups').delete().eq('id', signup.id)
        if (error) throw error
        await recordActivity(admin, sheet, 'Member signup released', member?.character_name || 'Member', 'signup', signup.id)
        return json(res, 200, { released: true })
      }
      const { data: targetSignup } = await admin.from('cta_signups').select('id').eq('sheet_id', sheet.id).eq('slot_id', body.slotId).maybeSingle()
      if (targetSignup) return json(res, 409, { error: 'That slot has already been claimed. Refresh the sheet and choose another.' })
      const { data: targetSlot, error: targetSlotError } = await admin.from('cta_slots').select('id, party_id').eq('id', body.slotId).maybeSingle()
      if (targetSlotError) throw targetSlotError
      const parties = await partyIds(admin, sheet.id)
      if (!targetSlot || !parties.includes(targetSlot.party_id)) return json(res, 400, { error: 'That slot does not belong to this sheet.' })
      const { data: updated, error: updateError } = await admin.from('cta_signups').update({ slot_id: body.slotId, updated_at: new Date().toISOString() }).eq('id', signup.id).select('*').single()
      if (updateError) throw updateError
      await recordActivity(admin, sheet, 'Member moved to another slot', member?.character_name || 'Member', 'signup', signup.id, { slotId: body.slotId })
      return json(res, 200, { signup: { id: updated.id, slotId: updated.slot_id, memberId: updated.member_id, memberName: member?.character_name || 'Member', attendanceStatus: updated.attendance_status } })
    }

    return json(res, 400, { error: 'Unsupported CTA sheet action.' })
  } catch (error) {
    return json(res, 500, { error: error.message || 'Could not load the CTA sheet.' })
  }
}
