'use strict'

(function () {
  const $ = (id) => document.getElementById(id)

  const state = {
    files: [],
    selected: null,
    parsed: null,
    content: '',
    search: '',
    sortKey: '__row',
    sortDir: 'asc',
    viewMode: 'table',
    refreshTimer: null,
    loading: false
  }

  const KIND_LABELS = {
    loot: 'Loot',
    killfeed: 'Killfeed',
    debug: 'Debug',
    other: 'TXT'
  }

  const TYPE_LABELS = {
    loot: 'Loot log',
    killfeed: 'Killfeed log',
    generic: 'Generic text log',
    empty: 'Empty file'
  }

  function toast(message) {
    const el = $('toast')
    el.textContent = message
    el.classList.remove('hidden')
    clearTimeout(toast._timer)
    toast._timer = setTimeout(() => el.classList.add('hidden'), 4000)
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '—'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString()
  }

  function formatTime(date) {
    if (!date) return '—'
    return date.toLocaleTimeString()
  }

  async function api(path) {
    const response = await fetch(path, { cache: 'no-store' })
    let data
    try {
      data = await response.json()
    } catch (_) {
      throw new Error('Invalid response from server.')
    }
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Request failed.')
    }
    return data
  }

  async function loadFileList() {
    try {
      const data = await api('/api/files')
      state.files = data.files || []
      $('directoryLabel').textContent = data.directory || ''
      $('fileCount').textContent = String(state.files.length)
      renderFileList()
    } catch (error) {
      $('fileList').innerHTML =
        '<p class="muted">Could not load files: ' + escapeHtml(error.message) + '</p>'
    }
  }

  function renderFileList() {
    const list = $('fileList')

    if (state.files.length === 0) {
      list.innerHTML =
        '<p class="muted">No .txt log files found. They appear here after the logger writes to them.</p>'
      return
    }

    list.innerHTML = state.files
      .map((file) => {
        const active = state.selected && state.selected === file.name
        return (
          '<button class="file-item' +
          (active ? ' active' : '') +
          '" data-name="' +
          escapeAttr(file.name) +
          '">' +
          '<div class="name">' +
          escapeHtml(file.name) +
          '</div>' +
          '<div class="meta">' +
          '<span class="kind kind-' +
          file.kind +
          '">' +
          (KIND_LABELS[file.kind] || 'TXT') +
          '</span>' +
          '<span>' +
          formatBytes(file.size) +
          '</span>' +
          '<span>' +
          escapeHtml(formatDate(file.modified)) +
          '</span>' +
          '</div>' +
          '</button>'
        )
      })
      .join('')

    list.querySelectorAll('.file-item').forEach((button) => {
      button.addEventListener('click', () => selectFile(button.dataset.name))
    })
  }

  async function selectFile(name) {
    state.selected = name
    renderFileList()
    $('emptyState').classList.add('hidden')
    $('viewer').classList.remove('hidden')
    $('fileName').textContent = name
    $('fileMeta').textContent = 'Loading…'
    $('typeNotice').classList.add('hidden')

    await reloadFile(false)

    const current = state.files.find((file) => file.name === name)
    if (current) {
      $('fileMeta').textContent =
        formatBytes(current.size) + ' · modified ' + formatDate(current.modified)
    }
  }

  async function reloadFile(notify) {
    if (!state.selected || state.loading) return
    state.loading = true

    try {
      const data = await api('/api/file?name=' + encodeURIComponent(state.selected))
      state.content = data.content || ''
      state.parsed = LogParser.parseLog(state.content)
      $('fileMeta').textContent =
        formatBytes(data.size) + ' · modified ' + formatDate(data.modified)
      renderAll()
      if (notify) toast('Reloaded ' + state.selected)
    } catch (error) {
      toast('Could not read file: ' + error.message)
    } finally {
      state.loading = false
    }
  }

  function renderAll() {
    renderSummary()
    renderNotice()
    renderTable()
    renderRaw()
    updateViewMode()
  }

  function renderSummary() {
    const el = $('summary')
    const parsed = state.parsed

    if (!parsed || parsed.type === 'empty') {
      el.innerHTML = stat('Status', 'No data yet')
      return
    }

    const summary = LogParser.summarize(parsed)
    const stats = []

    stats.push(stat('Rows', summary.rows))

    if (summary.totalQuantity != null) {
      stats.push(stat('Total quantity', summary.totalQuantity))
      stats.push(stat('Unique items', summary.uniqueItems))
      stats.push(stat('Looters', summary.uniquePlayers))
      stats.push(stat('Looted from', summary.uniqueSources))
    }

    if (summary.uniqueVictims != null) {
      stats.push(stat('Victims', summary.uniqueVictims))
      stats.push(stat('Killers', summary.uniqueKillers))
    }

    if (summary.columns != null) {
      stats.push(stat('Columns', summary.columns))
    }

    if (summary.topItem) {
      stats.push(stat('Top item', summary.topItem.name + ' ×' + summary.topItem.value, true))
    }

    if (summary.topPlayer) {
      stats.push(stat('Top looter', summary.topPlayer.name + ' ×' + summary.topPlayer.value, true))
    }

    el.innerHTML = stats.join('')
  }

  function stat(label, value, small) {
    return (
      '<div class="stat"><div class="label">' +
      escapeHtml(label) +
      '</div><div class="value' +
      (small ? ' small' : '') +
      '">' +
      escapeHtml(String(value)) +
      '</div></div>'
    )
  }

  function renderNotice() {
    const el = $('typeNotice')
    const parsed = state.parsed
    if (!parsed) return

    if (parsed.type === 'generic') {
      el.textContent =
        'This file does not match a known loot/killfeed header. Showing raw columns.'
      el.classList.remove('hidden')
    } else if (parsed.type === 'empty') {
      el.textContent = 'This file is empty. Data will appear once the logger writes to it.'
      el.classList.remove('hidden')
    } else {
      el.classList.add('hidden')
    }
  }

  function renderTable() {
    const parsed = state.parsed
    const thead = $('tableHead')
    const tbody = $('tableBody')

    if (!parsed) {
      thead.innerHTML = ''
      tbody.innerHTML = ''
      return
    }

    thead.innerHTML =
      '<tr><th data-key="__row">#</th>' +
      parsed.header
        .map(
          (column) =>
            '<th data-key="' + escapeAttr(column) + '">' + escapeHtml(column) + '</th>'
        )
        .join('') +
      '</tr>'

    thead.querySelectorAll('th').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.key
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'
        } else {
          state.sortKey = key
          state.sortDir = 'asc'
        }
        renderTable()
      })
    })

    let rows = LogParser.filterRows(parsed, state.search)
    rows = LogParser.sortRows(parsed, rows, state.sortKey, state.sortDir)

    const limit = 2000
    const visible = rows.slice(0, limit)

    tbody.innerHTML = visible
      .map((row) => {
        const cells = row.cells
          .map((cell) => '<td title="' + escapeAttr(cell) + '">' + escapeHtml(cell) + '</td>')
          .join('')
        return '<tr><td>' + (row.index + 1) + '</td>' + cells + '</tr>'
      })
      .join('')

    $('noResults').classList.toggle('hidden', rows.length !== 0)

    const suffix = rows.length > limit ? ' (showing first ' + limit + ')' : ''
    $('rowCount').textContent = rows.length + ' rows' + suffix
    $('lastUpdated').textContent = 'Updated ' + formatTime(new Date())
  }

  function renderRaw() {
    $('rawView').textContent = state.content || ''
  }

  function updateViewMode() {
    const isTable = state.viewMode === 'table'
    $('tableWrap').classList.toggle('hidden', !isTable)
    $('rawView').classList.toggle('hidden', isTable)
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;')
  }

  function downloadCurrent() {
    if (!state.selected) return
    const blob = new Blob([state.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = state.selected
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function setupAutoRefresh() {
    const checkbox = $('autoRefresh')
    const interval = $('refreshInterval')

    const restart = () => {
      if (state.refreshTimer) {
        clearInterval(state.refreshTimer)
        state.refreshTimer = null
      }
      if (checkbox.checked) {
        const ms = Number(interval.value) || 5000
        state.refreshTimer = setInterval(() => {
          loadFileList()
          if (state.selected) reloadFile(false)
        }, ms)
      }
    }

    checkbox.addEventListener('change', restart)
    interval.addEventListener('change', restart)
  }

  function init() {
    $('refreshListBtn').addEventListener('click', loadFileList)
    $('reloadBtn').addEventListener('click', () => reloadFile(true))
    $('downloadBtn').addEventListener('click', downloadCurrent)
    $('backBtn').addEventListener('click', () => {
      state.selected = null
      state.parsed = null
      $('viewer').classList.add('hidden')
      $('emptyState').classList.remove('hidden')
      renderFileList()
    })

    $('searchInput').addEventListener('input', (event) => {
      state.search = event.target.value
      renderTable()
    })

    document.querySelectorAll('input[name="viewMode"]').forEach((radio) => {
      radio.addEventListener('change', (event) => {
        state.viewMode = event.target.value
        updateViewMode()
      })
    })

    setupAutoRefresh()
    loadFileList()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
