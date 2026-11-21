import React, { useEffect, useMemo, useRef, useState } from 'react'
import './lootLogger.css'
import { filterRows, parseLog, sortRows, summarize } from './lib/lootParser'

export const LOOT_LOGGER_RELEASES_URL = 'https://github.com/Venersiss/loot-logger/releases/latest'
export const LOOT_LOGGER_REPO_URL = 'https://github.com/Venersiss/loot-logger'
export const NPCAP_URL = 'https://npcap.com/#download'

const PAGE_SIZE = 200
const MAX_FILE_BYTES = 25 * 1024 * 1024
const OTHER_TIER = { key: 'other', label: 'Other', color: '#7d746b' }
const TIER_COLORS = { 1: '#9a948c', 2: '#a58a6c', 3: '#7fae84', 4: '#6aa0cf', 5: '#cf6a5f', 6: '#e0913f', 7: '#e6c45a', 8: '#f3ede4' }
const fmt = new Intl.NumberFormat('en-US')
const toQty = (value) => Number(String(value ?? '').replace(/,/g, '')) || 0

// Albion item IDs look like T5_MAIN_SWORD@2 (tier 5, enchantment 2).
function tierOf(itemId) {
  const match = /^T([1-8])_.*?(?:@([1-4]))?$/.exec(itemId || '')
  if (!match) return OTHER_TIER
  const tier = Number(match[1])
  return { key: `T${tier}`, label: match[2] ? `T${tier}.${match[2]}` : `T${tier}`, color: TIER_COLORS[tier], tier }
}

// A realistic example so new members can see the result before installing anything.
const SAMPLE_ITEMS = [
  ['T8_2H_HALBERD_MORGANA@3', "Elder's Carrioncaller", 1],
  ['T6_ARMOR_PLATE_KEEPER@1', "Master's Judicator Armor", 1],
  ['T7_MAIN_RAPIER_MORGANA@2', "Grandmaster's Bloodletter", 1],
  ['T6_CAPEITEM_FW_BRIDGEWATCH@1', "Master's Bridgewatch Cape", 1],
  ['T6_POTION_HEAL', "Master's Healing Potion", 5],
  ['T8_MEAL_STEW', 'Beef Stew', 8],
  ['T7_HEAD_LEATHER_SET2@1', "Grandmaster's Assassin Hood", 1],
  ['T4_BAG', "Adept's Bag", 1],
]
const SAMPLE_LOOTERS = ['Kaelthar', 'Mirelle', 'Brakkus', 'Sootfang', 'Wrenna']
const SAMPLE_VICTIMS = [['Hollow Crown', 'Duskreaver'], ['Hollow Crown', 'Velmora'], ['Iron Tide', 'Grimsby'], ['Coup De Grace', 'Lysander']]

// Two of the sample looters die later in the fight, so the "died after looting" colour shows.
function buildSampleKillfeed() {
  const header = 'date;utc_time;killed_player__guild;killed_player__name;killer_player__guild;killer_player__name;event_type;logger_version'
  const rows = [
    ['19:13:40', 'Coup De Grace', 'Lysander', 'Hollow Crown', 'Duskreaver'],
    ['19:16:02', 'Hollow Crown', 'Duskreaver', 'Coup De Grace', 'Kaelthar'],
    ['19:18:30', 'Coup De Grace', 'Brakkus', 'Iron Tide', 'Grimsby'],
    ['19:19:55', 'Coup De Grace', 'Wrenna', 'Hollow Crown', 'Velmora'],
  ].map(([time, vg, victim, kg, killer]) => `21-11-2026;${time};${vg};${victim};${kg};${killer};killfeed;sample`)
  return [header, ...rows].join('\n')
}

function buildSampleLog() {
  const header = 'date;utc_time;looted_by__alliance;looted_by__guild;looted_by__name;item_id;item_name;quantity;looted_from__alliance;looted_from__guild;looted_from__name;case_id;logger_version'
  const rows = Array.from({ length: 34 }, (_, i) => {
    const [id, name, qty] = SAMPLE_ITEMS[(i * 3) % SAMPLE_ITEMS.length]
    const [guild, victim] = SAMPLE_VICTIMS[i % SAMPLE_VICTIMS.length]
    const looter = SAMPLE_LOOTERS[(i * 2) % SAMPLE_LOOTERS.length]
    const minute = String(14 + Math.floor(i / 6)).padStart(2, '0')
    const second = String((i * 7) % 60).padStart(2, '0')
    return `21-11-2026;19:${minute}:${second};CDG;Coup De Grace;${looter};${id};${name};${qty + (i % 3 === 0 ? 1 : 0)};;${guild};${victim};case278;sample`
  })
  return [header, ...rows].join('\n')
}

// Item icons come from Albion's official render server. Only the item ID is requested.
const iconUrl = (itemId, size) => `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png?size=${size}`

function ItemIcon({ itemId, name = '', size = 32 }) {
  const [failed, setFailed] = useState(false)
  if (failed || !itemId || itemId.startsWith('unknown_')) return <span className="ll-icon ll-icon-empty" style={{ width: size, height: size }} aria-hidden="true" />
  return <img className="ll-icon" src={iconUrl(itemId, size * 2)} width={size} height={size} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function Glyph({ name, size = 18 }) {
  const paths = {
    download: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>,
    upload: <><path d="M12 20V9" /><path d="m7 14 5-5 5 5" /><path d="M5 4h14" /></>,
    shield: <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
    x: <path d="M6 6l12 12M18 6 6 18" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function TierStrip({ rows }) {
  const tiers = useMemo(() => {
    const totals = new Map()
    for (const { record } of rows) {
      const tier = tierOf(record.item_id)
      const entry = totals.get(tier.key) || { ...tier, qty: 0 }
      entry.qty += toQty(record.quantity)
      totals.set(tier.key, entry)
    }
    const order = (t) => (t.key === 'other' ? 99 : t.tier)
    return [...totals.values()].sort((a, b) => order(a) - order(b))
  }, [rows])
  const total = tiers.reduce((sum, t) => sum + t.qty, 0)
  if (!total) return null
  return <div className="ll-tiers">
    <div className="ll-tiers-head"><h3>Loot by tier</h3><span>{fmt.format(total)} items</span></div>
    <div className="ll-tier-bar" role="img" aria-label={`Loot by tier: ${tiers.map((t) => `${t.label} ${t.qty}`).join(', ')}`}>
      {tiers.map((t) => <span key={t.key} style={{ flexGrow: t.qty, background: t.color }} title={`${t.label}: ${fmt.format(t.qty)}`} />)}
    </div>
    <ul className="ll-tier-legend">{tiers.map((t) => <li key={t.key}><i style={{ background: t.color }} />{t.label}<b>{fmt.format(t.qty)}</b></li>)}</ul>
  </div>
}

function Ledger({ items }) {
  return <dl className="ll-ledger">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><span className="ll-leader" aria-hidden="true" /><dd>{typeof value === 'number' ? fmt.format(value) : value}</dd></div>)}</dl>
}

function itemTotals(rows) {
  const totals = new Map()
  for (const { record } of rows) {
    if (!record.item_id) continue
    const entry = totals.get(record.item_id) || { id: record.item_id, name: record.item_name || record.item_id, qty: 0, looters: new Set() }
    entry.qty += toQty(record.quantity)
    if (record.looted_by__name) entry.looters.add(record.looted_by__name)
    totals.set(record.item_id, entry)
  }
  return [...totals.values()].sort((a, b) => b.qty - a.qty)
}

function TopItems({ rows }) {
  const top = useMemo(() => itemTotals(rows).slice(0, 8), [rows])
  if (!top.length) return null
  return <div className="ll-top">
    <h3>Most looted</h3>
    <ul>{top.map((item) => <li key={item.id} title={`${item.name} (${item.id})`}><ItemIcon itemId={item.id} name={item.name} size={56} /><b>{fmt.format(item.qty)}</b><span>{item.name}</span></li>)}</ul>
  </div>
}

function Cell({ column, value }) {
  if (column === 'item_id' && value) {
    const tier = tierOf(value)
    return <span className="ll-item"><ItemIcon itemId={value} size={32} /><span className="ll-chip" style={{ '--tier': tier.color }}>{tier.label}</span>{value}</span>
  }
  return value
}

const VIEWS = [['looters', 'Looters'], ['items', 'Items'], ['events', 'All events']]

const STATUS = {
  died: { label: 'Died after looting', hint: 'The looter died later, so this was probably lost.' },
  guild: { label: 'From a guildmate', hint: 'Taken from your own guild member’s body. Should probably go back.' },
  normal: { label: 'Looted', hint: 'Picked up and not lost, as far as the logs show.' },
}

// Death times per player (lower-cased name), from any loaded killfeed files.
export function deathIndex(files) {
  const index = new Map()
  for (const f of files) {
    if (f.parsed.type !== 'killfeed') continue
    for (const { record, timestamp } of f.parsed.rows) {
      const name = (record.killed_player__name || '').toLowerCase()
      if (!name || !timestamp) continue
      if (!index.has(name)) index.set(name, [])
      index.get(name).push(timestamp.getTime())
    }
  }
  return index
}

function statusOf(row, deaths) {
  const { record, timestamp } = row
  const looter = (record.looted_by__name || '').toLowerCase()
  const times = deaths.get(looter)
  if (times && timestamp && times.some((t) => t > timestamp.getTime())) return 'died'
  const guild = record.looted_by__guild
  if (guild && record.looted_from__guild && guild === record.looted_from__guild) return 'guild'
  return 'normal'
}

const fmtTime = (date) => (date ? date.toISOString().slice(11, 19) : '')

function Looters({ rows, deaths, hasKillfeed, term }) {
  const looters = useMemo(() => {
    const byPlayer = new Map()
    for (const row of rows) {
      const { record } = row
      const name = record.looted_by__name || 'Unknown'
      const player = byPlayer.get(name) || { name, guild: record.looted_by__guild, qty: 0, groups: new Map(), died: 0 }
      const status = statusOf(row, deaths)
      const key = `${record.item_id}|${status}`
      const group = player.groups.get(key) || { id: record.item_id, name: record.item_name || record.item_id, status, qty: 0, from: new Set(), first: row.timestamp }
      const qty = toQty(record.quantity)
      group.qty += qty
      if (record.looted_from__name) group.from.add(record.looted_from__name)
      player.qty += qty
      if (status === 'died') player.died += qty
      player.groups.set(key, group)
      byPlayer.set(name, player)
    }
    const order = { died: 0, guild: 1, normal: 2 }
    return [...byPlayer.values()]
      .map((p) => ({ ...p, groups: [...p.groups.values()].sort((a, b) => order[a.status] - order[b.status] || b.qty - a.qty) }))
      .sort((a, b) => b.qty - a.qty)
  }, [rows, deaths])

  const counts = useMemo(() => {
    const c = { died: 0, guild: 0, normal: 0 }
    for (const p of looters) for (const g of p.groups) c[g.status] += g.qty
    return c
  }, [looters])

  const shown = looters.filter((p) => !term || `${p.name} ${p.guild} ${p.groups.map((g) => g.name).join(' ')}`.toLowerCase().includes(term))

  return <div className="ll-looters-wrap">
    <div className="ll-legend" aria-label="Colour key">
      {Object.entries(STATUS).map(([key, s]) => <span key={key} className={`ll-legend-item st-${key}`} title={s.hint}><i />{s.label}<b>{fmt.format(counts[key])}</b></span>)}
      {!hasKillfeed && <span className="ll-legend-tip">Add the killfeed file from the same session to see who died after looting.</span>}
    </div>
    <ul className="ll-looters">
      {shown.map((p) => <li key={p.name} className="ll-looter">
        <div className="ll-looter-head">
          <span className="ll-looter-name"><b>{p.name}</b>{p.guild && <small>{p.guild}</small>}</span>
          <span className="ll-looter-total">{fmt.format(p.qty)}<small>items</small></span>
          {p.died > 0 && <span className="ll-looter-flag">Died after looting {fmt.format(p.died)}</span>}
        </div>
        <ul className="ll-loot-grid">
          {p.groups.map((g) => <li key={`${g.id}|${g.status}`} className={`ll-loot-tile st-${g.status}`} title={`${g.name}${g.qty > 1 ? ` ×${g.qty}` : ''}\nFrom: ${[...g.from].join(', ') || 'unknown'}\n${STATUS[g.status].label}${g.first ? ` · first at ${fmtTime(g.first)} UTC` : ''}`}>
            <ItemIcon itemId={g.id} name={g.name} size={48} />
            {g.qty > 1 && <b>{fmt.format(g.qty)}</b>}
            <span className="ll-sr">{g.name}, {STATUS[g.status].label}</span>
          </li>)}
        </ul>
      </li>)}
      {!shown.length && <li className="ll-empty">No looters match "{term}".</li>}
    </ul>
  </div>
}

function LogView({ file, deaths = new Map(), hasKillfeed = false }) {
  const { parsed } = file
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: '__row', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [view, setView] = useState('looters')
  const summary = useMemo(() => summarize(parsed), [parsed])
  const rows = useMemo(() => sortRows(filterRows(parsed.rows, search), parsed.header, sort.key, sort.dir), [parsed, search, sort])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const isLoot = summary.type === 'loot'
  const term = search.trim().toLowerCase()

  const items = useMemo(() => (isLoot ? itemTotals(parsed.rows) : []), [parsed, isLoot])
  const shownItems = items.filter((it) => !term || `${it.name} ${it.id} ${[...it.looters].join(' ')}`.toLowerCase().includes(term))

  if (parsed.type === 'empty') return <div className="ll-callout"><strong>This file has no events yet.</strong><p>The logger creates the file when the first event happens. If you only picked up your own items after dying, nothing is logged. See "Why is my log empty?" below.</p></div>

  const ledger = [['Events', summary.rows]]
  if (isLoot) ledger.push(['Items looted', summary.total], ['Unique items', summary.items.size], ['Looters', summary.players.size], ['Looted from', summary.sources])
  if (summary.type === 'killfeed') ledger.push(['Victims', summary.victims], ['Killers', summary.killers])
  const first = parsed.rows[0]?.timestamp
  if (first) ledger.push(['First event (UTC)', first.toISOString().replace('T', ' ').slice(0, 19)])
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const count = !isLoot || view === 'events' ? `${fmt.format(rows.length)} events` : view === 'items' ? `${fmt.format(shownItems.length)} items` : `${fmt.format(summary.players.size)} looters`

  return <div className="ll-view">
    <div className="ll-summary">
      <Ledger items={ledger} />
      {isLoot && <TierStrip rows={parsed.rows} />}
    </div>
    {isLoot && <TopItems rows={parsed.rows} />}
    {parsed.type === 'generic' && <p className="ll-note">This file doesn't look like a loot or killfeed log, so its raw columns are shown.</p>}
    <div className="ll-toolbar">
      <label className="ll-search"><span className="ll-sr">Search this log</span><input type="search" placeholder="Search a player, item or guild" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></label>
      {isLoot && <div className="ll-seg" role="tablist" aria-label="View">{VIEWS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'on' : ''} onClick={() => setView(key)}>{label}</button>)}</div>}
      <span className="ll-count">{count}</span>
    </div>

    {view === 'looters' && isLoot && <Looters rows={parsed.rows} deaths={deaths} hasKillfeed={hasKillfeed} term={term} />}

    {view === 'items' && isLoot && <ul className="ll-items">{shownItems.map((it) => { const tier = tierOf(it.id); return <li key={it.id}><ItemIcon itemId={it.id} name={it.name} size={44} /><span className="ll-items-name"><b>{it.name}</b><small><span className="ll-chip" style={{ '--tier': tier.color }}>{tier.label}</span>{[...it.looters].slice(0, 3).join(', ')}{it.looters.size > 3 ? ` +${it.looters.size - 3}` : ''}</small></span><span className="ll-qty">{fmt.format(it.qty)}<small>looted</small></span></li> })}{!shownItems.length && <li className="ll-empty">No items match "{search}".</li>}</ul>}

    {(view === 'events' || !isLoot) && <>
      <div className="ll-table-wrap"><table className="ll-table">
        <thead><tr><th onClick={() => toggleSort('__row')}>#</th>{parsed.header.map((h) => <th key={h} aria-sort={sort.key === h ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => toggleSort(h)}>{h.replace(/__/g, ' ').replace(/_/g, ' ')}{sort.key === h ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>)}</tr></thead>
        <tbody>{visible.map((row) => <tr key={row.index}><td className="ll-rownum">{row.index}</td>{row.cells.map((cell, i) => <td key={i} title={cell} className={parsed.header[i] === 'item_name' ? 'll-cell-name' : parsed.header[i] === 'item_id' ? 'll-cell-id' : undefined}><Cell column={parsed.header[i]} value={cell} /></td>)}</tr>)}</tbody>
      </table></div>
      {!rows.length && <p className="ll-empty">No events match "{search}".</p>}
      {pages > 1 && <div className="ll-pager"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current + 1} of {pages}</span><button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}
    </>}
  </div>
}

const FAQ = [
  ['Why is my log empty?', <>The logger records loot taken from <b>someone else</b>: other players looting near you, or you looting mobs and other players. Picking your own gear back up after you die is not logged. Also start the logger <b>before</b> you log in, or change zone once, so it knows which character is you.</>],
  ['Where do I find my log files?', <>In the same folder you extracted the logger to. They are named <code>loot-events-…txt</code> and <code>killfeed-events-…txt</code>. A file only appears once the first event is recorded.</>],
  ['Is it safe? Will I get banned?', <>It only reads network traffic on your own PC, the same way well-known Albion tools do. It doesn't change or inject into the game. Your log files are read here in your browser and are never uploaded.</>],
  ['What do the coloured borders mean?', <><b>Red</b>: the player died after picking it up, so it was probably lost (needs the killfeed file from the same session). <b>Blue</b>: it came from your own guild member’s body. <b>Neutral</b>: a normal pickup. Banking can’t be shown: depositing happens in that player’s own client, so no one else’s logger can see it.</>],
  ['It says Npcap is missing', <>Install Npcap from the button in step 1 and tick <b>"WinPcap API-compatible Mode"</b> during setup, then start the logger again.</>],
  ['It stopped logging after an Albion update', <>Run <b>Start Loot Logger (debug).cmd</b>, play for a minute, and send <code>debug-logs.txt</code> to an admin. Game updates sometimes renumber the events the logger listens to.</>],
]

export function LootLoggerPage({ standalone = false }) {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const loadCount = useRef(0)

  const addParsed = (loaded) => {
    if (!loaded.length) return
    loadCount.current += 1
    setFiles((prev) => { setSelected(prev.length); return [...prev, ...loaded] })
  }

  const addFiles = async (list) => {
    setError('')
    const loaded = []
    for (const file of Array.from(list)) {
      if (!/\.(txt|log|csv)$/i.test(file.name)) { setError(`${file.name} was skipped. Choose the .txt file the logger created.`); continue }
      if (file.size > MAX_FILE_BYTES) { setError(`${file.name} was skipped. Files over 25 MB are too large to open here; press "d" in the logger to start a new file more often.`); continue }
      loaded.push({ name: file.name, size: file.size, parsed: parseLog(await file.text()) })
    }
    addParsed(loaded)
  }

  const loadSample = () => {
    setError('')
    addParsed([
      { name: 'sample-loot-events.txt', sample: true, parsed: parseLog(buildSampleLog()) },
      { name: 'sample-killfeed-events.txt', sample: true, parsed: parseLog(buildSampleKillfeed()) },
    ])
  }
  const remove = (i) => { setFiles((prev) => prev.filter((_, n) => n !== i)); setSelected(0) }
  const clearAll = () => { setFiles([]); setSelected(0) }
  const openPicker = () => inputRef.current?.click()

  // Bring the results into view after a file is added.
  useEffect(() => {
    if (!loadCount.current || !resultsRef.current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    resultsRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [files.length])

  const active = files[selected]
  const hasFiles = files.length > 0
  const deaths = useMemo(() => deathIndex(files), [files])
  const hasKillfeed = files.some((f) => f.parsed.type === 'killfeed')

  return <div className={`ll-root ${standalone ? 'll-standalone' : ''}`}>
    <div className="ll-wrap">
      {standalone && <nav className="ll-nav"><a className="ll-brand" href="/"><span className="ll-mark">A<i>R</i></span>Coup De Grace</a><a href="/">Back to dashboard</a></nav>}

      <header className="ll-hero">
        <div className="ll-hero-copy">
          <p className="ll-eyebrow">Guild loot logs</p>
          <h1><span>Loot</span><span>Ledger</span></h1>
          <p className="ll-lede">See who picked up what after a fight. Run the logger while you play, then drop its file here.</p>
          <div className="ll-actions">
            <a className="ll-btn ll-btn-primary" href={LOOT_LOGGER_RELEASES_URL} target="_blank" rel="noopener noreferrer"><Glyph name="download" />Get Loot Logger</a>
            <a className="ll-btn" href="#setup">First time? Set up</a>
          </div>
          <p className="ll-fine"><Glyph name="shield" size={14} />Your files are read in your browser and never uploaded.</p>
        </div>

        <div className={`ll-crate ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
          <i className="ll-corner tl" /><i className="ll-corner tr" /><i className="ll-corner bl" /><i className="ll-corner br" />
          <span className="ll-crate-icon"><Glyph name="upload" size={26} /></span>
          <p className="ll-crate-title">{dragging ? 'Drop to open' : 'Drop your log here'}</p>
          <p className="ll-crate-sub"><code>loot-events-….txt</code> or <code>killfeed-events-….txt</code></p>
          <div className="ll-crate-actions">
            <button type="button" className="ll-btn ll-btn-primary" onClick={openPicker}>Choose file</button>
            <button type="button" className="ll-btn ll-btn-ghost" onClick={loadSample}><Glyph name="sparkle" size={16} />Try a sample</button>
          </div>
          <input ref={inputRef} type="file" accept=".txt,.log,.csv,text/plain" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
      </header>

      {error && <p className="ll-note" role="alert">{error}</p>}

      {hasFiles && <section className="ll-results" ref={resultsRef} aria-label="Your logs">
        <div className="ll-results-head">
          <h2>Your logs</h2>
          <div className="ll-results-actions"><button type="button" className="ll-link" onClick={openPicker}>Add another file</button><button type="button" className="ll-link" onClick={clearAll}>Clear</button></div>
        </div>
        <div className="ll-files">{files.map((f, i) => <span key={`${f.name}-${i}`} className={`ll-file ${i === selected ? 'on' : ''}`}><button type="button" onClick={() => setSelected(i)} aria-pressed={i === selected}>{f.name}<small>{f.sample ? 'sample' : f.parsed.type}</small></button><button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}><Glyph name="x" size={14} /></button></span>)}</div>
        {active?.sample && <p className="ll-sample-note">This is example data. Run the logger and drop your own file to see your fights.</p>}
        {active && <LogView key={`${active.name}-${selected}`} file={active} deaths={deaths} hasKillfeed={hasKillfeed} />}
      </section>}

      <section className="ll-setup" id="setup" aria-labelledby="ll-setup-title">
        <div className="ll-section-head"><p className="ll-eyebrow">First time here</p><h2 id="ll-setup-title">Set up in four steps</h2><p>Windows only. Takes about three minutes.</p></div>
        <ol className="ll-steps">
          <li><span className="ll-step-n">1</span><strong>Install Npcap</strong><p>It lets the logger see Albion's network traffic. Tick <b>"WinPcap API-compatible Mode"</b> during setup.</p><a className="ll-btn ll-btn-sm" href={NPCAP_URL} target="_blank" rel="noopener noreferrer"><Glyph name="download" size={16} />Get Npcap</a></li>
          <li><span className="ll-step-n">2</span><strong>Download the logger</strong><p>Get <code>ao-loot-logger-win.zip</code> and extract the whole folder anywhere.</p><a className="ll-btn ll-btn-sm ll-btn-primary" href={LOOT_LOGGER_RELEASES_URL} target="_blank" rel="noopener noreferrer"><Glyph name="download" size={16} />Get Loot Logger</a></li>
          <li><span className="ll-step-n">3</span><strong>Start it before Albion</strong><p>Double-click <b>Start Loot Logger.cmd</b> and allow admin access. Then log in. The window should say <b>ALBION DETECTED</b>.</p></li>
          <li><span className="ll-step-n">4</span><strong>Play, then drop the file</strong><p>Your log is saved in the logger's folder. Drop it here to see the loot.</p><button type="button" className="ll-btn ll-btn-sm" onClick={openPicker}><Glyph name="upload" size={16} />Choose file</button></li>
        </ol>
      </section>

      <section className="ll-faq" aria-labelledby="ll-faq-title">
        <div className="ll-section-head"><h2 id="ll-faq-title">Common questions</h2></div>
        <div className="ll-faq-list">{FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <p className="ll-fine">More help in the <a href={LOOT_LOGGER_REPO_URL} target="_blank" rel="noopener noreferrer">logger's README</a>.</p>
      </section>
    </div>
  </div>
}
