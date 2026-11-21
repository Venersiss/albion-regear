'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

// Files are served only from this machine's loopback interface.
const HOST = '127.0.0.1'
const PORT = Number(process.env.LOOT_VIEWER_PORT || 8765)

// Directory that holds the log files. Defaults to the parent of this folder.
const LOG_DIR = path.resolve(
  process.env.LOOT_VIEWER_LOG_DIR ||
    path.join(__dirname, '..')
)
const PUBLIC_DIR = path.join(__dirname, 'public')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  response.end(body)
}

function sendError(response, status, message) {
  sendJson(response, status, { ok: false, error: message })
}

function safeResolve(base, requested) {
  const resolved = path.resolve(base, requested)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (resolved !== base && !resolved.startsWith(prefix)) return null
  return resolved
}

function listFiles() {
  const entries = fs.readdirSync(LOG_DIR, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.txt')) continue

    const full = path.join(LOG_DIR, entry.name)
    let stats
    try {
      stats = fs.statSync(full)
    } catch (_) {
      continue
    }

    files.push({
      name: entry.name,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      kind: nameKind(entry.name)
    })
  }

  files.sort((a, b) => b.modified.localeCompare(a.modified))
  return files
}

function nameKind(name) {
  const lower = name.toLowerCase()
  if (lower.startsWith('loot-events')) return 'loot'
  if (lower.startsWith('killfeed-events')) return 'killfeed'
  if (lower.startsWith('debug')) return 'debug'
  return 'other'
}

function handleApi(request, response, url) {
  if (url.pathname === '/api/files' && request.method === 'GET') {
    try {
      return sendJson(response, 200, {
        ok: true,
        directory: LOG_DIR,
        files: listFiles()
      })
    } catch (error) {
      return sendError(response, 500, 'Could not list log files: ' + error.message)
    }
  }

  if (url.pathname === '/api/file' && request.method === 'GET') {
    const name = url.searchParams.get('name')
    if (!name) return sendError(response, 400, 'Missing file name.')

    // Only a bare file name is accepted - no directories, no traversal.
    if (name !== path.basename(name) || name.includes('..')) {
      return sendError(response, 400, 'Invalid file name.')
    }

    const full = safeResolve(LOG_DIR, name)
    if (!full) return sendError(response, 400, 'Invalid file path.')

    try {
      const text = fs.readFileSync(full, 'utf8')
      const stats = fs.statSync(full)

      return sendJson(response, 200, {
        ok: true,
        name,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        content: text
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        return sendError(response, 404, 'File not found: ' + name)
      }
      return sendError(response, 500, 'Could not read file: ' + error.message)
    }
  }

  return sendError(response, 404, 'Unknown API endpoint.')
}

function serveStatic(response, url) {
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/' || pathname === '') pathname = '/index.html'

  const full = safeResolve(PUBLIC_DIR, '.' + pathname)
  if (!full) {
    response.writeHead(400)
    return response.end('Bad request')
  }

  fs.readFile(full, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return response.end('Not found')
    }

    const ext = path.extname(full).toLowerCase()
    response.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    response.end(data)
  })
}

const server = http.createServer((request, response) => {
  let url
  try {
    url = new URL(request.url, `http://${HOST}:${PORT}`)
  } catch (_) {
    return sendError(response, 400, 'Invalid request URL.')
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApi(request, response, url)
  }

  return serveStatic(response, url)
})

server.listen(PORT, HOST, () => {
  console.log('AO Loot Logger Viewer running locally only:')
  console.log(`  http://${HOST}:${PORT}`)
  console.log(`  Logs directory: ${LOG_DIR}`)
  console.log('  Press Ctrl+C to stop.')
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set LOOT_VIEWER_PORT to another port.`)
  } else {
    console.error('Server error:', error.message)
  }
  process.exit(1)
})
