(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.LogParser = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const LOOT = 'loot'
  const KILLFEED = 'killfeed'
  const GENERIC = 'generic'
  const EMPTY = 'empty'

  function parseLog(text) {
    const clean = String(text == null ? '' : text).replace(/^\uFEFF/, '')
    const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length === 0) {
      return { header: [], rows: [], type: EMPTY, rawLines: 0 }
    }

    const header = splitLine(lines[0])
    const rows = []

    for (let index = 1; index < lines.length; index++) {
      const cells = splitLine(lines[index])

      while (cells.length < header.length) {
        cells.push('')
      }

      if (cells.length > header.length) {
        const extra = cells.splice(header.length - 1)
        cells.push(extra.join(';'))
      }

      rows.push({ index: index - 1, cells })
    }

    return {
      header,
      rows,
      type: detectType(header),
      rawLines: lines.length
    }
  }

  function splitLine(line) {
    return String(line).split(';').map((value) => value.trim())
  }

  function detectType(header) {
    const joined = header.join(';')

    if (joined.includes('item_id') && joined.includes('looted_by__name')) {
      return LOOT
    }

    if (
      joined.includes('killed_player__name') ||
      joined.includes('killer_player__name')
    ) {
      return KILLFEED
    }

    return GENERIC
  }

  function getCell(row, header, name) {
    const index = header.indexOf(name)
    return index === -1 ? '' : row.cells[index] || ''
  }

  function parseTimestamp(header, row) {
    const iso = getCell(row, header, 'timestamp_utc')

    if (iso) {
      const date = new Date(iso)
      if (!Number.isNaN(date.getTime())) return date
    }

    const dateText = getCell(row, header, 'date')
    const timeText = getCell(row, header, 'utc_time')

    if (dateText && timeText) {
      const dateMatch = dateText.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      const timeMatch = timeText.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/)

      if (dateMatch && timeMatch) {
        const date = new Date(
          Date.UTC(
            Number(dateMatch[3]),
            Number(dateMatch[2]) - 1,
            Number(dateMatch[1]),
            Number(timeMatch[1]),
            Number(timeMatch[2]),
            Number(timeMatch[3])
          )
        )

        if (!Number.isNaN(date.getTime())) return date
      }
    }

    return null
  }

  function toNumber(value) {
    const text = String(value == null ? '' : value).replace(/,/g, '')
    if (text.trim() === '') return 0
    const number = Number(text)
    return Number.isFinite(number) ? number : 0
  }

  function normalizeRow(header, row, type) {
    const base = { timestamp: parseTimestamp(header, row) }

    if (type === LOOT) {
      return Object.assign(base, {
        quantity: toNumber(getCell(row, header, 'quantity')),
        lootedBy: getCell(row, header, 'looted_by__name'),
        lootedByGuild: getCell(row, header, 'looted_by__guild'),
        lootedByAlliance: getCell(row, header, 'looted_by__alliance'),
        itemId: getCell(row, header, 'item_id'),
        itemName: getCell(row, header, 'item_name'),
        lootedFrom: getCell(row, header, 'looted_from__name'),
        lootedFromGuild: getCell(row, header, 'looted_from__guild'),
        lootedFromAlliance: getCell(row, header, 'looted_from__alliance'),
        caseId: getCell(row, header, 'case_id'),
        loggerVersion: getCell(row, header, 'logger_version')
      })
    }

    if (type === KILLFEED) {
      return Object.assign(base, {
        killedPlayer: getCell(row, header, 'killed_player__name'),
        killedGuild: getCell(row, header, 'killed_player__guild'),
        killerPlayer: getCell(row, header, 'killer_player__name'),
        killerGuild: getCell(row, header, 'killer_player__guild'),
        eventType: getCell(row, header, 'event_type'),
        loggerVersion: getCell(row, header, 'logger_version')
      })
    }

    return base
  }

  function topEntry(map) {
    let best = null

    for (const entry of map.entries()) {
      if (best == null || entry[1] > best.value) {
        best = { name: entry[0], value: entry[1] }
      }
    }

    return best
  }

  function summarize(parsed) {
    const { header, rows, type } = parsed
    const normalized = rows.map((row) => normalizeRow(header, row, type))
    const timestamps = normalized
      .map((row) => row.timestamp)
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime())

    const firstTimestamp = timestamps.length ? timestamps[0] : null
    const lastTimestamp = timestamps.length
      ? timestamps[timestamps.length - 1]
      : null

    if (type === LOOT) {
      let totalQuantity = 0
      const players = new Map()
      const items = new Map()
      const sources = new Map()

      for (const row of normalized) {
        totalQuantity += row.quantity

        if (row.lootedBy) {
          players.set(
            row.lootedBy,
            (players.get(row.lootedBy) || 0) + row.quantity
          )
        }

        const itemKey = row.itemName || row.itemId || 'Unknown item'
        items.set(itemKey, (items.get(itemKey) || 0) + row.quantity)

        if (row.lootedFrom) {
          sources.set(
            row.lootedFrom,
            (sources.get(row.lootedFrom) || 0) + row.quantity
          )
        }
      }

      return {
        type,
        rows: rows.length,
        totalQuantity,
        uniquePlayers: players.size,
        uniqueItems: items.size,
        uniqueSources: sources.size,
        topPlayer: topEntry(players),
        topItem: topEntry(items),
        topSource: topEntry(sources),
        firstTimestamp,
        lastTimestamp
      }
    }

    if (type === KILLFEED) {
      const victims = new Set()
      const killers = new Set()

      for (const row of normalized) {
        if (row.killedPlayer) victims.add(row.killedPlayer)

        if (
          row.killerPlayer &&
          row.killerPlayer.toLowerCase() !== 'unknown'
        ) {
          killers.add(row.killerPlayer)
        }
      }

      return {
        type,
        rows: rows.length,
        uniqueVictims: victims.size,
        uniqueKillers: killers.size,
        firstTimestamp,
        lastTimestamp
      }
    }

    return {
      type,
      rows: rows.length,
      columns: header.length,
      firstTimestamp,
      lastTimestamp
    }
  }

  function filterRows(parsed, search) {
    const term = String(search == null ? '' : search).trim().toLowerCase()
    if (!term) return parsed.rows

    return parsed.rows.filter((row) =>
      row.cells.some((cell) => String(cell).toLowerCase().includes(term))
    )
  }

  function sortRows(parsed, rows, key, direction) {
    const { header } = parsed
    const multiplier = direction === 'desc' ? -1 : 1
    const copy = rows.slice()

    copy.sort((a, b) => {
      let av
      let bv

      if (key === '__timestamp') {
        av = parseTimestamp(header, a)?.getTime() ?? 0
        bv = parseTimestamp(header, b)?.getTime() ?? 0
      } else if (key === '__row') {
        av = a.index
        bv = b.index
      } else {
        const index = header.indexOf(key)
        av = index === -1 ? '' : a.cells[index]
        bv = index === -1 ? '' : b.cells[index]

        const aNumber = String(av).trim() !== '' && Number.isFinite(Number(String(av).replace(/,/g, '')))
        const bNumber = String(bv).trim() !== '' && Number.isFinite(Number(String(bv).replace(/,/g, '')))

        if (aNumber && bNumber) {
          av = Number(String(av).replace(/,/g, ''))
          bv = Number(String(bv).replace(/,/g, ''))
        } else {
          av = String(av).toLowerCase()
          bv = String(bv).toLowerCase()
        }
      }

      if (av < bv) return -1 * multiplier
      if (av > bv) return 1 * multiplier
      return a.index - b.index
    })

    return copy
  }

  function toCsv(header, rows) {
    const quote = (value) => {
      const text = String(value == null ? '' : value)
      return /[;"\r\n]/.test(text)
        ? '"' + text.replace(/"/g, '""') + '"'
        : text
    }

    const lines = [header.map(quote).join(';')]

    for (const row of rows) {
      lines.push(row.cells.map(quote).join(';'))
    }

    return lines.join('\r\n')
  }

  return {
    parseLog,
    detectType,
    normalizeRow,
    summarize,
    filterRows,
    sortRows,
    toCsv,
    parseTimestamp,
    toNumber
  }
})
