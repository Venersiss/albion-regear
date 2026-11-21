import React, { useMemo, useRef, useState } from 'react'
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

// Albion item IDs look like T5_MAIN_SWORD@2 (tier 5, enchantment 2).
function tierOf(itemId) {
  const match = /^T([1-8])_.*?(?:@([1-4]))?$/.exec(itemId || '')
  if (!match) return OTHER_TIER
  const tier = Number(match[1])
  return { key: `T${tier}`, label: match[2] ? `T${tier}.${match[2]}` : `T${tier}`, color: TIER_COLORS[tier], tier }
}

const STEPS = [
  ['Install Npcap', 'Tick "WinPcap API-compatible mode" during setup.'],
  ['Get the logger', 'Download the zip from GitHub and extract it anywhere.'],
  ['Run as administrator', 'Start Albion. The window should say ALBION DETECTED.'],
  ['Upload the log', 'Drop loot-events-*.txt into the crate above.'],
]

function TierStrip({ rows }) {
  const tiers = useMemo(() => {
    const totals = new Map()
    for (const { record } of rows) {
      const tier = tierOf(record.item_id)
      const qty = Number(String(record.quantity).replace(/,/g, '')) || 0
      const entry = totals.get(tier.key) || { ...tier, qty: 0 }
      entry.qty += qty
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

// Item icons come from Albion's official render server. Only the item ID is requested.
const iconUrl = (itemId, size) => `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png?size=${size}`

function ItemIcon({ itemId, name = '', size = 32 }) {
  const [failed, setFailed] = useState(false)
  if (failed || !itemId || itemId.startsWith('unknown_')) return <span className="ll-icon ll-icon-empty" style={{ width: size, height: size }} aria-hidden="true" />
  return <img className="ll-icon" src={iconUrl(itemId, size * 2)} width={size} height={size} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function TopItems({ rows }) {
  const top = useMemo(() => {
    const totals = new Map()
    for (const { record } of rows) {
      if (!record.item_id) continue
      const entry = totals.get(record.item_id) || { id: record.item_id, name: record.item_name || record.item_id, qty: 0 }
      entry.qty += Number(String(record.quantity).replace(/,/g, '')) || 0
      totals.set(record.item_id, entry)
    }
    return [...totals.values()].sort((a, b) => b.qty - a.qty).slice(0, 8)
  }, [rows])
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

function LogView({ file }) {
  const { parsed } = file
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: '__row', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [view, setView] = useState('events')
  const summary = useMemo(() => summarize(parsed), [parsed])
  const rows = useMemo(() => sortRows(filterRows(parsed.rows, search), parsed.header, sort.key, sort.dir), [parsed, search, sort])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const players = useMemo(() => {
    if (summary.type !== 'loot') return []
    const byPlayer = new Map()
    for (const { record } of parsed.rows) {
      const name = record.looted_by__name || 'Unknown'
      const entry = byPlayer.get(name) || { name, guild: record.looted_by__guild, qty: 0, lines: 0 }
      entry.qty += Number(String(record.quantity).replace(/,/g, '')) || 0
      entry.lines += 1
      byPlayer.set(name, entry)
    }
    return [...byPlayer.values()].sort((a, b) => b.qty - a.qty)
  }, [parsed, summary.type])
  const term = search.trim().toLowerCase()
  const shownPlayers = players.filter((p) => !term || `${p.name} ${p.guild}`.toLowerCase().includes(term))
  const topQty = shownPlayers[0]?.qty || 1

  if (parsed.type === 'empty') return <p className="ll-empty">This file is empty. Events appear once the logger records its first loot.</p>
  const ledger = [['Rows', summary.rows]]
  if (summary.type === 'loot') ledger.push(['Items looted', summary.total], ['Unique items', summary.items.size], ['Looters', summary.players.size], ['Looted from', summary.sources])
  if (summary.type === 'killfeed') ledger.push(['Victims', summary.victims], ['Killers', summary.killers])
  const first = parsed.rows[0]?.timestamp
  if (first) ledger.push(['First event (UTC)', first.toISOString().replace('T', ' ').slice(0, 19)])
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return <div className="ll-view">
    <div className="ll-summary">
      <Ledger items={ledger} />
      {summary.type === 'loot' && <TierStrip rows={parsed.rows} />}
    </div>
    {summary.type === 'loot' && <TopItems rows={parsed.rows} />}
    {parsed.type === 'generic' && <p className="ll-note">This file doesn't match a loot or killfeed header, so raw columns are shown.</p>}
    <div className="ll-toolbar">
      <label className="ll-search"><span className="ll-sr">Search log</span><input type="search" placeholder="Search player, item or guild" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></label>
      {summary.type === 'loot' && <div className="ll-seg" role="tablist"><button type="button" role="tab" aria-selected={view === 'events'} className={view === 'events' ? 'on' : ''} onClick={() => setView('events')}>Events</button><button type="button" role="tab" aria-selected={view === 'players'} className={view === 'players' ? 'on' : ''} onClick={() => setView('players')}>By player</button></div>}
      <span className="ll-count">{fmt.format(view === 'players' ? shownPlayers.length : rows.length)} {view === 'players' ? 'players' : 'rows'}</span>
    </div>
    {view === 'players' && summary.type === 'loot'
      ? <ol className="ll-rank">{shownPlayers.map((p, i) => <li key={p.name}><span className="ll-pos">{i + 1}</span><span className="ll-who"><b>{p.name}</b>{p.guild && <small>{p.guild}</small>}</span><span className="ll-bar"><i style={{ width: `${(p.qty / topQty) * 100}%` }} /></span><span className="ll-qty">{fmt.format(p.qty)}<small>{p.lines} events</small></span></li>)}{!shownPlayers.length && <li className="ll-empty">No players match your search.</li>}</ol>
      : <>
        <div className="ll-table-wrap"><table className="ll-table">
          <thead><tr><th onClick={() => toggleSort('__row')}>#</th>{parsed.header.map((h) => <th key={h} aria-sort={sort.key === h ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => toggleSort(h)}>{h.replace(/__/g, ' ').replace(/_/g, ' ')}{sort.key === h ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>)}</tr></thead>
          <tbody>{visible.map((row) => <tr key={row.index}><td className="ll-rownum">{row.index}</td>{row.cells.map((cell, i) => <td key={i} title={cell}><Cell column={parsed.header[i]} value={cell} /></td>)}</tr>)}</tbody>
        </table></div>
        {!rows.length && <p className="ll-empty">No rows match your search.</p>}
        {pages > 1 && <div className="ll-pager"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current + 1} of {pages}</span><button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}
      </>}
  </div>
}

export function LootLoggerPage({ standalone = false }) {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const addFiles = async (list) => {
    setError('')
    const loaded = []
    for (const file of Array.from(list)) {
      if (!/\.(txt|log|csv)$/i.test(file.name)) { setError(`${file.name} skipped. Only .txt log files are supported.`); continue }
      if (file.size > MAX_FILE_BYTES) { setError(`${file.name} skipped. Files over 25 MB can't be read in the browser.`); continue }
      loaded.push({ name: file.name, size: file.size, parsed: parseLog(await file.text()) })
    }
    if (loaded.length) setFiles((prev) => { setSelected(prev.length); return [...prev, ...loaded] })
  }
  const remove = (i) => { setFiles((prev) => prev.filter((_, n) => n !== i)); setSelected(0) }
  const active = files[selected]

  return <div className={`ll-root ${standalone ? 'll-standalone' : ''}`}>
    <div className="ll-wrap">
      {standalone && <nav className="ll-nav"><span className="ll-brand"><span className="ll-mark">A<i>R</i></span>Coup De Grace</span><a href="/">Admin sign in</a></nav>}
      <header className="ll-hero">
        <div className="ll-hero-copy">
          <p className="ll-eyebrow">Guild loot logs</p>
          <h1><span>Loot</span><span>Ledger</span></h1>
          <p className="ll-lede">Drop in your logger files to see who picked up what. Your files are read in your browser and never uploaded. Item icons load from Albion's own image server.</p>
          <div className="ll-actions">
            <a className="ll-btn ll-btn-primary" href={LOOT_LOGGER_RELEASES_URL} target="_blank" rel="noopener noreferrer">Get Loot Logger</a>
            <a className="ll-btn" href={NPCAP_URL} target="_blank" rel="noopener noreferrer">Get Npcap</a>
          </div>
          <p className="ll-fine">Windows only. You need both: Npcap captures the traffic, the logger writes the files. <a href={LOOT_LOGGER_REPO_URL} target="_blank" rel="noopener noreferrer">Full README</a></p>
        </div>
        <div className={`ll-crate ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
          <i className="ll-corner tl" /><i className="ll-corner tr" /><i className="ll-corner bl" /><i className="ll-corner br" />
          <p className="ll-crate-title">Drop log files here</p>
          <p className="ll-crate-sub"><code>loot-events-*.txt</code> or <code>killfeed-events-*.txt</code></p>
          <button type="button" className="ll-btn ll-btn-primary" onClick={() => inputRef.current?.click()}>Choose files</button>
          <input ref={inputRef} type="file" accept=".txt,.log,.csv,text/plain" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
      </header>

      <ol className="ll-steps">{STEPS.map(([title, text], i) => <li key={title}><span className="ll-step-n">{i + 1}</span><strong>{title}</strong><p>{text}</p></li>)}</ol>

      {error && <p className="ll-note" role="alert">{error}</p>}
      {files.length > 0 && <section className="ll-results" aria-label="Loaded logs">
        <div className="ll-files">{files.map((f, i) => <span key={`${f.name}-${i}`} className={`ll-file ${i === selected ? 'on' : ''}`}><button type="button" onClick={() => setSelected(i)}>{f.name}<small>{f.parsed.type}</small></button><button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}>×</button></span>)}</div>
        {active && <LogView key={`${active.name}-${selected}`} file={active} />}
      </section>}
    </div>
  </div>
}
