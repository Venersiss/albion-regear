// Client-side port of loot-logger/viewer/public/parser.js.
// Parses the semicolon-delimited loot-events-*.txt / killfeed-events-*.txt files written by the AO Loot Logger.

export function parseLog(text) {
  const clean = String(text ?? '').replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (!lines.length) return { header: [], rows: [], type: 'empty' }
  const header = splitLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    while (cells.length < header.length) cells.push('')
    if (cells.length > header.length) { const extra = cells.splice(header.length - 1); cells.push(extra.join(';')) }
    const record = Object.fromEntries(header.map((name, index) => [name, cells[index]]))
    rows.push({ index: i, cells, record, timestamp: parseTimestamp(record) })
  }
  return { header, rows, type: detectType(header) }
}

const splitLine = (line) => String(line).split(';').map((value) => value.trim())

function detectType(header) {
  const joined = header.join(';')
  if (joined.includes('item_id') && joined.includes('looted_by__name')) return 'loot'
  if (joined.includes('killed_player__name') || joined.includes('killer_player__name')) return 'killfeed'
  return 'generic'
}

function parseTimestamp(record) {
  if (record.timestamp_utc) { const d = new Date(record.timestamp_utc); if (!Number.isNaN(d.getTime())) return d }
  const dateMatch = record.date?.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  const timeMatch = record.utc_time?.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (dateMatch && timeMatch) {
    const d = new Date(Date.UTC(+dateMatch[3], +dateMatch[2] - 1, +dateMatch[1], +timeMatch[1], +timeMatch[2], +timeMatch[3]))
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

const toNumber = (value) => { const n = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }

export function summarize(parsed) {
  const { rows, type } = parsed
  if (type === 'loot') {
    const players = new Map(); const items = new Map(); const sources = new Set()
    let total = 0
    for (const { record } of rows) {
      const qty = toNumber(record.quantity)
      total += qty
      if (record.looted_by__name) players.set(record.looted_by__name, (players.get(record.looted_by__name) || 0) + qty)
      const item = record.item_name || record.item_id || 'Unknown item'
      items.set(item, (items.get(item) || 0) + qty)
      if (record.looted_from__name) sources.add(record.looted_from__name)
    }
    return { type, rows: rows.length, total, players, items, sources: sources.size }
  }
  if (type === 'killfeed') {
    const victims = new Set(); const killers = new Set()
    for (const { record } of rows) {
      if (record.killed_player__name) victims.add(record.killed_player__name)
      if (record.killer_player__name && record.killer_player__name.toLowerCase() !== 'unknown') killers.add(record.killer_player__name)
    }
    return { type, rows: rows.length, victims: victims.size, killers: killers.size }
  }
  return { type, rows: rows.length }
}

export function filterRows(rows, search) {
  const term = search.trim().toLowerCase()
  return term ? rows.filter((row) => row.cells.some((cell) => cell.toLowerCase().includes(term))) : rows
}

export function sortRows(rows, header, key, direction) {
  const dir = direction === 'desc' ? -1 : 1
  const idx = header.indexOf(key)
  return rows.slice().sort((a, b) => {
    let av; let bv
    if (key === '__row') { av = a.index; bv = b.index }
    else if (idx === -1) { av = a.timestamp?.getTime() ?? 0; bv = b.timestamp?.getTime() ?? 0 }
    else {
      av = a.cells[idx]; bv = b.cells[idx]
      const an = av.trim() !== '' && Number.isFinite(Number(av.replace(/,/g, '')))
      const bn = bv.trim() !== '' && Number.isFinite(Number(bv.replace(/,/g, '')))
      if (an && bn) { av = Number(av.replace(/,/g, '')); bv = Number(bv.replace(/,/g, '')) } else { av = av.toLowerCase(); bv = bv.toLowerCase() }
    }
    return av < bv ? -dir : av > bv ? dir : a.index - b.index
  })
}
