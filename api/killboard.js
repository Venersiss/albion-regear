// Kill log for the guild, read from Albion's public game API (Asia server).
// The browser can't call the game API directly, so this function fetches it, keeps only
// what the dashboard needs and lets Vercel's CDN cache the answer.
//   GET /api/killboard?offset=0     recent battles the guild fought in (50 per page)
//   GET /api/killboard?day=2026-11-21  every battle that started on that UTC day
//   GET /api/killboard?battle=123   deaths and kills of one battle
import itemNames from './_data/albionItems.js'

const API = 'https://gameinfo-sgp.albiononline.com/api/gameinfo'
const GUILD_ID = '0p51LCdZRnOy3wwGL9KaQg'
const ALLIANCE_ID = 'b1ydkre3QZCe4vNTI6OLLw'
const BATTLE_PAGE = 50
const EVENT_PAGE = 51
const MAX_EVENT_PAGES = 20
// The game API only pages 10,000 battles back (about four months for this guild).
const MAX_BATTLE_OFFSET = 9999
const DAY_MS = 24 * 60 * 60 * 1000
const GEAR_SLOTS = [['MainHand', 'Weapon'], ['OffHand', 'Off hand'], ['Head', 'Head'], ['Armor', 'Armor'], ['Shoes', 'Boots'], ['Cape', 'Cape'], ['Bag', 'Bag'], ['Mount', 'Mount'], ['Potion', 'Potion'], ['Food', 'Food']]

async function gameApi(path) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let wait = 600 * (attempt + 1)
    try {
      const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
      if (response.ok) return await response.json()
      lastError = new Error(response.status === 429 ? "The Albion killboard is busy right now. Wait a few seconds and try again." : `The Albion killboard answered ${response.status}.`)
      if (response.status < 500 && response.status !== 429) break
      // Too many requests: back off longer before asking again.
      if (response.status === 429) wait = 1500 * (attempt + 1)
    } catch (error) {
      lastError = error.name === 'TimeoutError' ? new Error('The Albion killboard took too long to answer.') : error
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, wait))
  }
  throw lastError
}

// "T6_2H_AXE_AVALON@3" -> { tier: '6.3', name: 'Realmbreaker' }
function describeItem(type) {
  const match = String(type || '').match(/^T(\d)_(.+?)(?:@(\d))?$/)
  if (!match) return { tier: '', name: type }
  const [, tier, base, enchant] = match
  return { tier: `${tier}.${enchant || 0}`, name: itemNames[base] || base.replace(/_/g, ' ').toLowerCase() }
}

function gear(equipment = {}) {
  return GEAR_SLOTS.map(([key, slot]) => {
    const item = equipment?.[key]
    if (!item?.Type) return null
    return { slot, type: item.Type, quality: item.Quality || 0, count: item.Count || 1, ...describeItem(item.Type) }
  }).filter(Boolean)
}

function person(entry = {}, withGear = false) {
  return {
    id: entry.Id,
    name: entry.Name,
    guild: entry.GuildName || '',
    guildId: entry.GuildId || '',
    alliance: entry.AllianceTag || entry.AllianceName || '',
    ours: entry.GuildId === GUILD_ID,
    allied: entry.AllianceId === ALLIANCE_ID,
    ip: Math.round(entry.AverageItemPower || 0),
    ...(withGear ? { gear: gear(entry.Equipment) } : {}),
  }
}

function summarizeBattle(battle) {
  const ours = battle.guilds?.[GUILD_ID] || {}
  const players = Object.values(battle.players || {})
  const ourPlayers = players.filter((player) => player.guildId === GUILD_ID).length
  const opponents = Object.values(battle.guilds || {})
    .filter((guild) => guild.id !== GUILD_ID && guild.allianceId !== ALLIANCE_ID)
    .map((guild) => ({ name: guild.name, alliance: guild.alliance || '', players: players.filter((player) => player.guildId === guild.id).length, kills: guild.kills || 0 }))
    .sort((first, second) => second.players - first.players || second.kills - first.kills)
  return {
    id: battle.id,
    startTime: battle.startTime,
    endTime: battle.endTime,
    totalKills: battle.totalKills || 0,
    totalFame: battle.totalFame || 0,
    totalPlayers: players.length,
    ourPlayers,
    ourKills: ours.kills || 0,
    ourDeaths: ours.deaths || 0,
    opponents: opponents.slice(0, 4),
    moreOpponents: Math.max(0, opponents.length - 4),
  }
}

// Start time of the battle at one offset (newest first). Past the end of the list counts as "older than anything".
async function battleTime(offset) {
  const rows = await gameApi(`/battles?guildId=${GUILD_ID}&limit=1&offset=${offset}&sort=recent`)
  return { offset, time: rows?.[0] ? Date.parse(rows[0].startTime) : Number.NEGATIVE_INFINITY }
}

// The game API can't filter battles by date, but its list is sorted newest first. Find where the
// day ends in that list by estimating from the guild's battle rate and narrowing down (one request
// at a time: the API rate-limits bursts), then read pages from there.
async function battlesForDay(day) {
  const start = Date.parse(`${day}T00:00:00Z`)
  const end = start + DAY_MS
  if (start > Date.now()) return { battles: [], tooOld: false }
  let newer = await battleTime(0) // invariant: newer.time >= end, older.time < end
  let from = 0
  if (newer.time >= end) {
    let older = await battleTime(MAX_BATTLE_OFFSET)
    if (older.time >= end) return { battles: [], tooOld: true }
    for (let step = 0; step < 16 && older.offset - newer.offset > BATTLE_PAGE; step += 1) {
      const span = older.offset - newer.offset
      let guess
      if (Number.isFinite(older.time) && step < 8) {
        guess = newer.offset + Math.round(((newer.time - end) / (newer.time - older.time)) * span)
        guess += guess - newer.offset < span / 2 ? 15 : -15 // aim a little past the estimate so each probe tightens both sides
      } else {
        guess = newer.offset + Math.floor(span / 2)
      }
      const probe = await battleTime(Math.min(older.offset - 1, Math.max(newer.offset + 1, guess)))
      if (probe.time >= end) newer = probe
      else older = probe
    }
    from = newer.offset
  }
  const battles = []
  for (let offset = from; offset <= MAX_BATTLE_OFFSET; offset += BATTLE_PAGE) {
    const rows = await gameApi(`/battles?guildId=${GUILD_ID}&limit=${Math.min(BATTLE_PAGE, MAX_BATTLE_OFFSET - offset + 1)}&offset=${offset}&sort=recent`)
    for (const battle of rows || []) {
      const time = Date.parse(battle.startTime)
      if (time >= start && time < end && !battles.some((entry) => entry.id === battle.id)) battles.push(battle)
    }
    const last = rows?.[rows.length - 1]
    if (!rows || rows.length < BATTLE_PAGE || Date.parse(last.startTime) < start) {
      // Reached the oldest battle the API will return while still inside the day: the day is cut off.
      const cutOff = offset + BATTLE_PAGE > MAX_BATTLE_OFFSET && last && Date.parse(last.startTime) >= start
      return { battles, tooOld: false, partial: Boolean(cutOff) }
    }
  }
  return { battles, tooOld: false, partial: true }
}

async function battleEvents(battleId) {
  const seen = new Map()
  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const rows = await gameApi(`/events/battle/${battleId}?offset=${page * EVENT_PAGE}&limit=${EVENT_PAGE}`)
    for (const row of rows || []) seen.set(row.EventId, row)
    if (!rows || rows.length < EVENT_PAGE) break
  }
  const events = [...seen.values()].sort((first, second) => new Date(first.TimeStamp) - new Date(second.TimeStamp))
  const shape = (event) => ({
    id: event.EventId,
    time: event.TimeStamp,
    fame: event.TotalVictimKillFame || 0,
    participants: event.numberOfParticipants || (event.Participants || []).length,
    killer: person(event.Killer),
    victim: person(event.Victim, true),
  })
  return {
    deaths: events.filter((event) => event.Victim?.GuildId === GUILD_ID).map(shape),
    kills: events.filter((event) => event.Killer?.GuildId === GUILD_ID || (event.Participants || []).some((entry) => entry.GuildId === GUILD_ID)).filter((event) => event.Victim?.GuildId !== GUILD_ID).map(shape),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const battleId = String(req.query.battle || '')
    if (battleId) {
      if (!/^\d{1,12}$/.test(battleId)) return res.status(400).json({ error: 'Unknown battle.' })
      const [battle, events] = await Promise.all([gameApi(`/battles/${battleId}`), battleEvents(battleId)])
      // A battle that ended recently can still grow; older ones never change.
      const settled = Date.now() - new Date(battle?.endTime || 0).getTime() > 30 * 60 * 1000
      res.setHeader('Cache-Control', settled ? 's-maxage=3600, stale-while-revalidate=86400' : 's-maxage=60, stale-while-revalidate=300')
      return res.status(200).json({ battle: battle ? summarizeBattle(battle) : null, ...events })
    }
    const day = String(req.query.day || '')
    if (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return res.status(400).json({ error: 'Pick a valid date.' })
      const result = await battlesForDay(day)
      // Finished days don't change; today keeps growing.
      const finished = Date.parse(`${day}T00:00:00Z`) + DAY_MS + 30 * 60 * 1000 < Date.now()
      res.setHeader('Cache-Control', finished ? 's-maxage=3600, stale-while-revalidate=86400' : 's-maxage=60, stale-while-revalidate=300')
      return res.status(200).json({ day, tooOld: result.tooOld, partial: Boolean(result.partial), battles: result.battles.map(summarizeBattle) })
    }
    const offset = Math.max(0, Math.min(MAX_BATTLE_OFFSET - BATTLE_PAGE + 1, Number.parseInt(req.query.offset, 10) || 0))
    const battles = await gameApi(`/battles?guildId=${GUILD_ID}&limit=${BATTLE_PAGE}&offset=${offset}&sort=recent`)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ battles: (battles || []).map(summarizeBattle), hasMore: (battles || []).length === BATTLE_PAGE, offset })
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ error: error.message || 'The Albion killboard could not be reached.' })
  }
}
