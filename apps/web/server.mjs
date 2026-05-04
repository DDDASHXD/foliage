import { createServer } from "node:http"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import fs from "node:fs/promises"
import process from "node:process"
import path from "node:path"
import next from "next"
import pty from "node-pty"
import { WebSocket, WebSocketServer } from "ws"

const require = createRequire(import.meta.url)
const { getYDoc, setupWSConnection } = require("y-websocket/bin/utils")

const appDirectory = fileURLToPath(new URL(".", import.meta.url))
const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "0.0.0.0"
const port = Number.parseInt(process.env.PORT ?? "3000", 10)
const text = new TextDecoder("utf-8", { fatal: true })
const maxDirectoryEntries = 500
const ignoredDirectoryNames = new Set([".git", ".next", ".turbo"])

const getArgumentValue = (name) => {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`))

  if (inline) {
    return inline.slice(name.length + 1)
  }

  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]

  if (!value || value.startsWith("--")) {
    return undefined
  }

  return value
}

const requestedWorkspace = getArgumentValue("--workspace")
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
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(data))
}

const getRelativePath = (value = "") => {
  const cleanPath = String(value).replaceAll("\\", "/")

  if (cleanPath === "." || cleanPath === "/") {
    return ""
  }

  return cleanPath.replace(/^\/+/, "")
}

const resolveWorkspacePath = (relativePath = "") => {
  const resolvedPath = path.resolve(workspaceRoot, relativePath)
  const relativeFromWorkspace = path.relative(workspaceRoot, resolvedPath)

  if (relativeFromWorkspace.startsWith("..") || path.isAbsolute(relativeFromWorkspace)) {
    throw new Error("Path is outside the workspace.")
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
    throw new Error("Only text files can be opened.")
  }

  return text.decode(buffer)
}

const writeTextFile = async (relativePath, value) => {
  const absolutePath = resolveWorkspacePath(relativePath)
  await fs.writeFile(absolutePath, value, "utf8")
}

const getDirectoryEntries = async (relativePath = "") => {
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
      const entryPath = path.posix.join(relativePath.replaceAll(path.sep, "/"), entry.name)

      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? "directory" : "file",
      }
    })
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`)

  if (url.pathname === "/api/workspace") {
    const relativePath = getRelativePath(url.searchParams.get("path") ?? "")

    void getDirectoryEntries(relativePath)
      .then((entries) => {
        sendJson(response, 200, {
          root: {
            name: workspaceName,
            path: "",
          },
          entries,
        })
      })
      .catch((error) => {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid path." })
      })

    return
  }

  handle(request, response)
})

const terminalServer = new WebSocketServer({ noServer: true })
const collaborationServer = new WebSocketServer({ noServer: true })

const initializeCollaborationDoc = async (docName) => {
  const doc = getYDoc(docName)
  const metadata = doc.getMap("metadata")

  if (metadata.get("initialized") === true) {
    return
  }

  const yText = doc.getText("monaco")
  const fileText = await readTextFile(docName).catch(() => "")

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
      }, 250)
    )
  })

  metadata.set("initialized", true)
}

terminalServer.on("connection", (socket) => {
  const shell = process.env.SHELL ?? "/bin/zsh"
  const terminal = pty.spawn(shell, ["-l"], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: workspaceRoot,
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  })

  sockets.add(terminal)
  send(socket, { type: "connected" })

  const dataDisposable = terminal.onData((data) => {
    send(socket, { type: "data", data })
  })

  const exitDisposable = terminal.onExit(({ exitCode, signal }) => {
    send(socket, { type: "exit", code: exitCode, signal })
    socket.close()
  })

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString())

      if (message.type === "input" && typeof message.data === "string") {
        terminal.write(message.data)
      }

      if (message.type === "resize") {
        const cols = Number.parseInt(String(message.cols), 10)
        const rows = Number.parseInt(String(message.rows), 10)

        if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) {
          terminal.resize(cols, rows)
        }
      }
    } catch {
      send(socket, { type: "error", message: "Invalid terminal message." })
    }
  })

  socket.on("close", () => {
    dataDisposable.dispose()
    exitDisposable.dispose()
    sockets.delete(terminal)
    terminal.kill()
  })
})

collaborationServer.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`)
  const docName = decodeURIComponent(
    url.pathname.replace(/^\/collaboration\/?/, "")
  )

  void initializeCollaborationDoc(docName)
    .then(() => {
      setupWSConnection(socket, request, { docName })
    })
    .catch(() => {
      socket.close()
    })
})

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`)

  if (url.pathname === "/terminal") {
    terminalServer.handleUpgrade(request, socket, head, (webSocket) => {
      terminalServer.emit("connection", webSocket, request)
    })

    return
  }

  if (url.pathname === "/collaboration" || url.pathname.startsWith("/collaboration/")) {
    collaborationServer.handleUpgrade(request, socket, head, (webSocket) => {
      collaborationServer.emit("connection", webSocket, request)
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

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

server.listen(port, hostname, () => {
  console.log(`OpenMD workspace: ${workspaceRoot}`)
  console.log(`Ready on http://${hostname}:${port}`)
})
