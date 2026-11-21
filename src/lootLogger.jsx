import React, { useMemo, useRef, useState } from 'react'
import { filterRows, parseLog, sortRows, summarize } from './lib/lootParser'

export const LOOT_LOGGER_RELEASES_URL = 'https://github.com/Venersiss/loot-logger/releases/latest'
export const LOOT_LOGGER_REPO_URL = 'https://github.com/Venersiss/loot-logger'
export const NPCAP_URL = 'https://npcap.com/#download'

const PAGE_SIZE = 200
const MAX_FILE_BYTES = 25 * 1024 * 1024
const fmtTime = (date) => (date ? date.toISOString().replace('T', ' ').slice(0, 19) : '')

function SetupGuide() {
  return <section className="loot-panel">
    <h2>Get the Loot Logger</h2>
    <p className="loot-muted">The logger runs on your own Windows PC while you play Albion Online. It reads the game's network traffic (it never touches game files) and writes loot and killfeed logs that you upload below.</p>
    <ol className="loot-steps">
      <li>
        <div><strong>Install Npcap</strong><p>Download and install Npcap. During setup, tick <b>"Install Npcap in WinPcap API-compatible Mode"</b>.</p></div>
        <a className="button button-primary" href={NPCAP_URL} target="_blank" rel="noopener noreferrer">Download Npcap</a>
      </li>
      <li>
        <div><strong>Download the Loot Logger</strong><p>Open the GitHub releases page and download <code>ao-loot-logger-win.zip</code>, then extract it anywhere.</p></div>
        <a className="button button-primary" href={LOOT_LOGGER_RELEASES_URL} target="_blank" rel="noopener noreferrer">Download Loot Logger</a>
      </li>
      <li>
        <div><strong>Run it as Administrator</strong><p>Right-click the logger and choose <b>Run as administrator</b>, then start Albion. The window should say <b>ALBION DETECTED</b>. If it doesn't, press the restart key shown in the window.</p></div>
      </li>
      <li>
        <div><strong>Play, then upload the log</strong><p>Loot events are saved next to the logger as <code>loot-events-*.txt</code> (and <code>killfeed-events-*.txt</code>). Drop those files in the box below to view them. Nothing is uploaded to a server; files are read in your browser.</p></div>
      </li>
    </ol>
    <p className="loot-muted">Loot logs only show what the game client sees: loot grabbed by <em>other</em> players near you. If nothing shows after a game update, the logger needs new event IDs. See the <a href={LOOT_LOGGER_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub README</a>.</p>
  </section>
}

function LogView({ file }) {
  const { parsed } = file
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: '__row', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [view, setView] = useState('table')
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

  if (parsed.type === 'empty') return <p className="loot-muted">This file is empty. Data appears once the logger records its first event.</p>
  const stats = [['Rows', summary.rows]]
  if (summary.type === 'loot') stats.push(['Total quantity', summary.total], ['Unique items', summary.items.size], ['Looters', summary.players.size], ['Looted from', summary.sources])
  if (summary.type === 'killfeed') stats.push(['Victims', summary.victims], ['Killers', summary.killers])
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return <div>
    <div className="loot-stats">{stats.map(([label, value]) => <div className="loot-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {parsed.type === 'generic' && <p className="loot-note">This file doesn't match a known loot or killfeed header, so raw columns are shown.</p>}
    <div className="loot-toolbar">
      <input type="search" placeholder="Search player, item, guild…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
      {summary.type === 'loot' && <div className="loot-tabs"><button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Events</button><button type="button" className={view === 'players' ? 'active' : ''} onClick={() => setView('players')}>By player</button></div>}
      <span className="loot-muted">{rows.length} rows</span>
    </div>
    {view === 'players' && summary.type === 'loot'
      ? <div className="loot-table-wrap"><table className="loot-table"><thead><tr><th>Player</th><th>Guild</th><th>Items looted</th><th>Loot events</th></tr></thead><tbody>{players.filter((p) => !search.trim() || `${p.name} ${p.guild}`.toLowerCase().includes(search.trim().toLowerCase())).map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.guild}</td><td>{p.qty}</td><td>{p.lines}</td></tr>)}</tbody></table></div>
      : <>
        <div className="loot-table-wrap"><table className="loot-table">
          <thead><tr><th onClick={() => toggleSort('__row')}>#</th>{parsed.header.map((h) => <th key={h} onClick={() => toggleSort(h)}>{h.replace(/__/g, ' ').replace(/_/g, ' ')}{sort.key === h ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
          <tbody>{visible.map((row) => <tr key={row.index}><td>{row.index}</td>{row.cells.map((cell, i) => <td key={i} title={cell}>{cell}</td>)}</tr>)}</tbody>
        </table></div>
        {!rows.length && <p className="loot-muted">No rows match your search.</p>}
        {pages > 1 && <div className="loot-pager"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current + 1} of {pages}</span><button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}
      </>}
    {parsed.rows[0] && <p className="loot-muted">First event {fmtTime(parsed.rows[0].timestamp) || '—'} UTC</p>}
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
      if (!/\.(txt|log|csv)$/i.test(file.name)) { setError(`${file.name} skipped: only .txt log files are supported.`); continue }
      if (file.size > MAX_FILE_BYTES) { setError(`${file.name} skipped: file is larger than 25 MB.`); continue }
      loaded.push({ name: file.name, size: file.size, parsed: parseLog(await file.text()) })
    }
    if (loaded.length) { setFiles((prev) => { setSelected(prev.length); return [...prev, ...loaded] }) }
  }
  const remove = (i) => { setFiles((prev) => prev.filter((_, n) => n !== i)); setSelected(0) }
  const active = files[selected]

  const body = <div className="loot-page">
    <header className="loot-header">
      <span className="eyebrow">Coup De Grace</span>
      <h1>Loot Logger</h1>
      <p className="loot-muted">Upload your AO Loot Logger files to browse, search and summarise loot. No login needed, and your files never leave your browser.</p>
    </header>
    <SetupGuide />
    <section className="loot-panel">
      <h2>View your logs</h2>
      <div className={`loot-drop ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}>
        <p>Drop <code>loot-events-*.txt</code> or <code>killfeed-events-*.txt</code> here</p>
        <button type="button" className="button button-primary" onClick={() => inputRef.current?.click()}>Choose files</button>
        <input ref={inputRef} type="file" accept=".txt,.log,.csv,text/plain" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>
      {error && <p className="loot-note" role="alert">{error}</p>}
      {files.length > 0 && <div className="loot-files">{files.map((f, i) => <span key={`${f.name}-${i}`} className={`loot-file ${i === selected ? 'active' : ''}`}><button type="button" onClick={() => setSelected(i)}>{f.name} <small>{f.parsed.type}</small></button><button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}>×</button></span>)}</div>}
      {active && <LogView key={`${active.name}-${selected}`} file={active} />}
    </section>
  </div>

  return standalone ? <div className="public-cta-shell loot-standalone">{body}</div> : body
}
