import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const webDirectory = path.resolve(scriptDirectory, '..')
const apiDirectory = path.join(webDirectory, 'app/api')
const apiStashDirectory = path.join(webDirectory, '.tauri-api-stash')

const stashApiRoutes = async () => {
  try {
    await fs.access(apiDirectory)
    await fs.rm(apiStashDirectory, { recursive: true, force: true })
    await fs.rename(apiDirectory, apiStashDirectory)
  } catch {
    // API routes already stashed or not present.
  }
}

const restoreApiRoutes = async () => {
  try {
    await fs.access(apiStashDirectory)
    await fs.rm(apiDirectory, { recursive: true, force: true })
    await fs.rename(apiStashDirectory, apiDirectory)
  } catch {
    // Nothing to restore.
  }
}

const runNextBuild = () =>
  new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'next', 'build'], {
      cwd: webDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        TAURI_BUILD: '1',
      },
    })

    child.on('close', (code) => {
      resolve(code ?? 1)
    })
  })

await stashApiRoutes()

const exitCode = await runNextBuild()

await restoreApiRoutes()

process.exit(exitCode)
