#!/usr/bin/env node

import { hasFlag } from '../src/lib/args.mjs'
import { startServer } from '../src/create-server.mjs'

const printHelp = () => {
  console.log(`Usage:
  foliage-server [options]

  Foliage workspace server: filesystem API, collaboration WebSocket, and Leafmark builds.

Options:
  --workspace <path>   Workspace root (default: current directory)
  --port <number>      Listen port (default: 3000, or PORT env)
  --hostname <host>    Bind address (default: 0.0.0.0, or HOSTNAME env)
  --headless           API and WebSocket only (default when --app-dir is omitted)
  --app-dir <path>     Next.js app directory for full UI mode
  --help, -h           Show this help

Examples:
  foliage-server --workspace ./notes --headless --port 8787
  foliage-server --workspace ./notes --port 8787
  foliage-server --workspace ./notes --app-dir ./apps/web --port 3000
`)
}

const argv = process.argv

if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
  printHelp()
  process.exit(0)
}

await startServer()
