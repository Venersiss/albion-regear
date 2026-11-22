// Kill log for the guild, read from Albion's public game API (Asia server).
// The browser can't call the game API directly, so this function fetches it, keeps only
// what the dashboard needs and lets Vercel's CDN cache the answer.
//   GET /api/killboard?offset=0     recent battles the guild fought in (50 per page)
//   GET /api/killboard?battle=123   deaths and kills of one battle
import itemNames from './_data/albionItems.js'

const API = 'https://gameinfo-sgp.albiononline.com/api/gameinfo'
const GUILD_ID = '0p51LCdZRnOy3wwGL9KaQg'
const ALLIANCE_ID = 'b1ydkre3QZCe4vNTI6OLLw'
const BATTLE_PAGE = 50
const EVENT_PAGE = 51
const MAX_EVENT_PAGES = 20
const GEAR_SLOTS = [['MainHand', 'Weapon'], ['OffHand', 'Off hand'], ['Head', 'Head'], ['Armor', 'Armor'], ['Shoes', 'Boots'], ['Cape', 'Cape'], ['Bag', 'Bag'], ['Mount', 'Mount'], ['Potion', 'Potion'], ['Food', 'Food']]

async function gameApi(path) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
      if (response.ok) return await response.json()
      lastError = new Error(`The Albion killboard answered ${response.status}.`)
      if (response.status < 500 && response.status !== 429) break
    } catch (error) {
      lastError = error.name === 'TimeoutError' ? new Error('The Albion killboard took too long to answer.') : error
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
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
    const offset = Math.max(0, Math.min(5000, Number.parseInt(req.query.offset, 10) || 0))
    const battles = await gameApi(`/battles?guildId=${GUILD_ID}&limit=${BATTLE_PAGE}&offset=${offset}&sort=recent`)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ battles: (battles || []).map(summarizeBattle), hasMore: (battles || []).length === BATTLE_PAGE, offset })
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ error: error.message || 'The Albion killboard could not be reached.' })
  }
}
