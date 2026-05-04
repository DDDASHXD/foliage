import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'node:path'
import busboy from 'busboy'
import next from 'next'
import pty from 'node-pty'
import { WebSocket, WebSocketServer } from 'ws'

const require = createRequire(import.meta.url)
const { getYDoc, setupWSConnection } = require('y-websocket/bin/utils')

const appDirectory = fileURLToPath(new URL('.', import.meta.url))
const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME ?? '0.0.0.0'
const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const text = new TextDecoder('utf-8', { fatal: true })
const maxDirectoryEntries = 500
const ignoredDirectoryNames = new Set(['.git', '.next', '.turbo'])

const getArgumentValue = (name) => {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`))

  if (inline) {
    return inline.slice(name.length + 1)
  }

  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]

  if (!value || value.startsWith('--')) {
    return undefined
  }

  return value
}

const requestedWorkspace = getArgumentValue('--workspace')
const workspaceRoot = path.resolve(requestedWorkspace ?? process.cwd())
const workspaceName = path.basename(workspaceRoot) || workspaceRoot

const app = next({ dev, hostname, port, dir: appDirectory })
const handle = app.getRequestHandler()
const sockets = new Set()
const docSaveTimers = new Map()

const send = (socket, message) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

await app.prepare()
const handleNextUpgrade = app.getUpgradeHandler()

const sendJson = (response, status, data) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

const readJsonBody = async (request) => {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8')

  if (!body) {
    return {}
  }

  return JSON.parse(body)
}

const getRelativePath = (value = '') => {
  const cleanPath = String(value).replaceAll('\\', '/')

  if (cleanPath === '.' || cleanPath === '/') {
    return ''
  }

  return cleanPath.replace(/^\/+/, '')
}

const getCleanEntryName = (value) => {
  const name = String(value ?? '').trim()

  if (!name || name === '.' || name === '..') {
    throw new Error('Name is required.')
  }

  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Name cannot include path separators.')
  }

  return name
}

const resolveWorkspacePath = (relativePath = '') => {
  const resolvedPath = path.resolve(workspaceRoot, relativePath)
  const relativeFromWorkspace = path.relative(workspaceRoot, resolvedPath)

  if (relativeFromWorkspace.startsWith('..') || path.isAbsolute(relativeFromWorkspace)) {
    throw new Error('Path is outside the workspace.')
  }

  return resolvedPath
}

const isTextBuffer = (buffer) => {
  if (buffer.includes(0)) {
    return false
  }

  try {
    text.decode(buffer)
    return true
  } catch {
    return false
  }
}

const readTextFile = async (relativePath) => {
  const absolutePath = resolveWorkspacePath(relativePath)
  const buffer = await fs.readFile(absolutePath)

  if (!isTextBuffer(buffer)) {
    throw new Error('Only text files can be opened.')
  }

  return text.decode(buffer)
}

const writeTextFile = async (relativePath, value) => {
  const absolutePath = resolveWorkspacePath(relativePath)
  await fs.writeFile(absolutePath, value, 'utf8')
}

const getDirectoryEntries = async (relativePath = '') => {
  const absolutePath = resolveWorkspacePath(relativePath)
  const entries = await fs.readdir(absolutePath, { withFileTypes: true })

  return entries
    .filter((entry) => !ignoredDirectoryNames.has(entry.name))
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, maxDirectoryEntries)
    .map((entry) => {
      const entryPath = path.posix.join(relativePath.replaceAll(path.sep, '/'), entry.name)

      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'directory' : 'file',
      }
    })
}

const createWorkspaceEntry = async ({ path: parentPath = '', name, type }) => {
  const cleanParentPath = getRelativePath(parentPath)
  const cleanName = getCleanEntryName(name)
  const entryPath = path.posix.join(cleanParentPath, cleanName)
  const absolutePath = resolveWorkspacePath(entryPath)

  if (type === 'file') {
    await fs.writeFile(absolutePath, '', { flag: 'wx' })
  } else if (type === 'directory') {
    await fs.mkdir(absolutePath)
  } else {
    throw new Error('Type must be file or directory.')
  }

  return {
    name: cleanName,
    path: entryPath,
    type,
  }
}

const clearSaveTimersForPath = (relativePath) => {
  const prefix = `${relativePath}/`

  for (const [docName, timer] of docSaveTimers) {
    if (docName === relativePath || docName.startsWith(prefix)) {
      clearTimeout(timer)
      docSaveTimers.delete(docName)
    }
  }
}

const deleteWorkspaceEntry = async ({ path: entryPath }) => {
  const cleanEntryPath = getRelativePath(entryPath)

  if (!cleanEntryPath) {
    throw new Error('Cannot delete the workspace root.')
  }

  const absolutePath = resolveWorkspacePath(cleanEntryPath)
  const stats = await fs.lstat(absolutePath)
  const type = stats.isDirectory() ? 'directory' : 'file'

  await fs.rm(absolutePath, { recursive: stats.isDirectory(), force: false })
  clearSaveTimersForPath(cleanEntryPath)

  return {
    name: path.basename(cleanEntryPath),
    path: cleanEntryPath,
    type,
  }
}

const moveWorkspaceEntry = async ({ path: entryPath, toDirectory }) => {
  const cleanFrom = getRelativePath(entryPath)
  const cleanToDir = getRelativePath(toDirectory ?? '')

  if (!cleanFrom) {
    throw new Error('Cannot move workspace root.')
  }

  const fromDirPrefix = `${cleanFrom}/`

  if (cleanToDir === cleanFrom || cleanToDir.startsWith(fromDirPrefix)) {
    throw new Error('Cannot move an item into itself or its children.')
  }

  const normalizedFrom = cleanFrom.replaceAll('\\', '/')
  const baseName = path.posix.basename(normalizedFrom)
  const newRelative = cleanToDir ? path.posix.join(cleanToDir, baseName) : baseName

  if (newRelative === cleanFrom) {
    throw new Error('Already in that location.')
  }

  const absFrom = resolveWorkspacePath(cleanFrom)
  const absTo = resolveWorkspacePath(newRelative)

  try {
    await fs.stat(absTo)
    throw new Error('Destination already exists.')
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      if (error.message === 'Destination already exists.') {
        throw error
      }

      throw error
    }
  }

  await fs.rename(absFrom, absTo)
  clearSaveTimersForPath(cleanFrom)

  const stats = await fs.lstat(absTo)
  const type = stats.isDirectory() ? 'directory' : 'file'

  return {
    from: cleanFrom,
    to: newRelative,
    type,
  }
}

const maxUploadBytes = 100 * 1024 * 1024

const uploadWorkspaceFile = (request) =>
  new Promise((resolve, reject) => {
    const contentType = request.headers['content-type']
    if (!contentType || !String(contentType).toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Expected multipart form data.'))
      return
    }

    let relativePathField = ''
    const fileChunks = []
    let sawFileField = false
    let limitHit = false
    let settled = false

    const settle = (fn) => {
      if (settled) {
        return
      }
      settled = true
      fn()
    }

    const bb = busboy({
      headers: request.headers,
      limits: { fileSize: maxUploadBytes },
    })

    bb.on('field', (name, value) => {
      if (name === 'path') {
        relativePathField = String(value ?? '')
      }
    })

    bb.on('file', (name, fileStream) => {
      if (name !== 'file') {
        fileStream.resume()
        return
      }
      sawFileField = true
      fileStream.on('data', (chunk) => {
        fileChunks.push(chunk)
      })
      fileStream.on('limit', () => {
        limitHit = true
      })
    })

    bb.on('error', (err) => {
      settle(() => reject(err))
    })

    bb.on('finish', () => {
      void (async () => {
        try {
          if (limitHit) {
            throw new Error('File too large.')
          }
          if (!sawFileField || !relativePathField.trim()) {
            throw new Error('Missing file or path.')
          }
          const clean = getRelativePath(relativePathField)
          if (!clean) {
            throw new Error('Invalid path.')
          }
          const abs = resolveWorkspacePath(clean)
          await fs.mkdir(path.dirname(abs), { recursive: true })
          await fs.writeFile(abs, Buffer.concat(fileChunks))
          settle(() => resolve({ path: clean.replaceAll(path.sep, '/') }))
        } catch (error) {
          settle(() =>
            reject(error instanceof Error ? error : new Error('Unable to upload file.')),
          )
        }
      })()
    })

    request.pipe(bb)
  })

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '', `http://${request.headers.host}`)

  if (url.pathname === '/api/workspace' && request.method === 'GET') {
    const relativePath = getRelativePath(url.searchParams.get('path') ?? '')

    void getDirectoryEntries(relativePath)
      .then((entries) => {
        sendJson(response, 200, {
          root: {
            name: workspaceName,
            path: '',
          },
          entries,
        })
      })
      .catch((error) => {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid path.' })
      })

    return
  }

  if (url.pathname === '/api/workspace' && request.method === 'POST') {
    void readJsonBody(request)
      .then((body) => createWorkspaceEntry(body))
      .then((entry) => {
        sendJson(response, 201, { entry })
      })
      .catch((error) => {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Unable to create entry.',
        })
      })

    return
  }

  if (url.pathname === '/api/workspace' && request.method === 'DELETE') {
    void readJsonBody(request)
      .then((body) => deleteWorkspaceEntry(body))
      .then((entry) => {
        sendJson(response, 200, { entry })
      })
      .catch((error) => {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Unable to delete entry.',
        })
      })

    return
  }

  if (url.pathname === '/api/workspace' && request.method === 'PATCH') {
    void readJsonBody(request)
      .then((body) => moveWorkspaceEntry(body))
      .then((result) => {
        sendJson(response, 200, result)
      })
      .catch((error) => {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Unable to move entry.',
        })
      })

    return
  }

  if (url.pathname === '/api/workspace' && request.method === 'PUT') {
    void uploadWorkspaceFile(request)
      .then((result) => {
        sendJson(response, 200, { success: true, path: result.path })
      })
      .catch((error) => {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Unable to upload file.',
        })
      })

    return
  }

  if (url.pathname === '/api/workspace/file' && request.method === 'GET') {
    const relativePath = getRelativePath(url.searchParams.get('path') ?? '')

    if (!relativePath) {
      sendJson(response, 400, { error: 'Path is required.' })
      return
    }

    void (async () => {
      try {
        const absolutePath = resolveWorkspacePath(relativePath)
        const stats = await fs.stat(absolutePath)

        if (!stats.isFile()) {
          sendJson(response, 400, { error: 'Not a file.' })
          return
        }

        const buffer = await fs.readFile(absolutePath)
        const ext = path.extname(absolutePath).toLowerCase()
        const mimeTypes = {
          '.pdf': 'application/pdf',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        }
        const contentType = mimeTypes[ext] ?? 'application/octet-stream'

        response.writeHead(200, {
          'content-type': contentType,
          'cache-control': 'no-store',
        })
        response.end(buffer)
      } catch (error) {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : 'Unable to read file.',
        })
      }
    })()

    return
  }

  if (url.pathname === '/api/workspace') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  handle(request, response)
})

const terminalServer = new WebSocketServer({ noServer: true })
const collaborationServer = new WebSocketServer({ noServer: true })

const initializeCollaborationDoc = async (docName) => {
  const doc = getYDoc(docName)
  const metadata = doc.getMap('metadata')

  if (metadata.get('initialized') === true) {
    return
  }

  const yText = doc.getText('monaco')
  const fileText = await readTextFile(docName).catch(() => '')

  if (yText.length === 0) {
    yText.insert(0, fileText)
  }

  yText.observe(() => {
    clearTimeout(docSaveTimers.get(docName))
    docSaveTimers.set(
      docName,
      setTimeout(() => {
        void writeTextFile(docName, yText.toString()).catch((error) => {
          console.error(`Unable to save ${docName}:`, error)
        })
      }, 250),
    )
  })

  metadata.set('initialized', true)
}

terminalServer.on('connection', (socket) => {
  const shell = process.env.SHELL ?? '/bin/zsh'
  const terminal = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: workspaceRoot,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  })

  sockets.add(terminal)
  send(socket, { type: 'connected' })

  const dataDisposable = terminal.onData((data) => {
    send(socket, { type: 'data', data })
  })

  const exitDisposable = terminal.onExit(({ exitCode, signal }) => {
    send(socket, { type: 'exit', code: exitCode, signal })
    socket.close()
  })

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString())

      if (message.type === 'input' && typeof message.data === 'string') {
        terminal.write(message.data)
      }

      if (message.type === 'resize') {
        const cols = Number.parseInt(String(message.cols), 10)
        const rows = Number.parseInt(String(message.rows), 10)

        if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) {
          terminal.resize(cols, rows)
        }
      }
    } catch {
      send(socket, { type: 'error', message: 'Invalid terminal message.' })
    }
  })

  socket.on('close', () => {
    dataDisposable.dispose()
    exitDisposable.dispose()
    sockets.delete(terminal)
    terminal.kill()
  })
})

collaborationServer.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '', `http://${request.headers.host}`)
  const docName = decodeURIComponent(url.pathname.replace(/^\/collaboration\/?/, ''))

  void initializeCollaborationDoc(docName)
    .then(() => {
      setupWSConnection(socket, request, { docName })
    })
    .catch(() => {
      socket.close()
    })
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '', `http://${request.headers.host}`)

  if (url.pathname === '/terminal') {
    terminalServer.handleUpgrade(request, socket, head, (webSocket) => {
      terminalServer.emit('connection', webSocket, request)
    })

    return
  }

  if (url.pathname === '/collaboration' || url.pathname.startsWith('/collaboration/')) {
    collaborationServer.handleUpgrade(request, socket, head, (webSocket) => {
      collaborationServer.emit('connection', webSocket, request)
    })

    return
  }

  handleNextUpgrade(request, socket, head)
})

const shutdown = () => {
  for (const socket of sockets) {
    socket.kill()
  }

  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.listen(port, hostname, () => {
  console.log(`OpenMD workspace: ${workspaceRoot}`)
  console.log(`Ready on http://${hostname}:${port}`)
})
