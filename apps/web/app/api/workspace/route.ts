import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const WORKSPACE_ROOT = path.join(os.homedir(), '.foliage', 'workspace')

async function ensureWorkspaceExists() {
  try {
    await fs.access(WORKSPACE_ROOT)
  } catch {
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true })
  }
}

function getSafePath(relativePath: string): string {
  const fullPath = path.resolve(WORKSPACE_ROOT, relativePath)
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Invalid path')
  }
  return fullPath
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()
    const relativePath = String(formData.get('path') ?? '')
      .replaceAll('\\', '/')
      .replace(/^\/+/, '')
    const file = formData.get('file') as File | null

    if (!file || !relativePath.trim()) {
      return NextResponse.json({ error: 'Missing file or path' }, { status: 400 })
    }

    const fullPath = resolveWorkspacePathApi(relativePath)
    const dir = path.dirname(fullPath)

    await fs.mkdir(dir, { recursive: true })
    const buffer = await file.arrayBuffer()
    await fs.writeFile(fullPath, Buffer.from(buffer))

    return NextResponse.json({ success: true, path: relativePath })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 },
    )
  }
}



export async function POST(request: NextRequest) {
  try {
    await ensureWorkspaceExists()
    const body = await request.json()
    const { path: relativePath, name, type } = body

    if (!name || !type || !relativePath === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!/^[\w.\-]+$/.test(name)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }

    const fullPath = getSafePath(path.join(relativePath, name))

    if (type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true })
    } else if (type === 'file') {
      const dir = path.dirname(fullPath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(fullPath, '', 'utf-8')
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create' },
      { status: 500 }
    )
  }
}

function getWorkspaceRoot() {
  return process.env.FOLIAGE_WORKSPACE ? path.resolve(process.env.FOLIAGE_WORKSPACE) : process.cwd()
}

function resolveWorkspacePathApi(relativePath: string) {
  const root = getWorkspaceRoot()
  const resolvedPath = path.resolve(root, relativePath.replaceAll('\\', '/').replace(/^\/+/, ''))
  const rel = path.relative(root, resolvedPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path is outside the workspace.')
  }
  return resolvedPath
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const entryPath = String(body.path ?? '')
    const toDirectory = body.toDirectory === undefined || body.toDirectory === null ? '' : String(body.toDirectory)

    const cleanFrom = entryPath.replaceAll('\\', '/').replace(/^\/+/, '')
    if (!cleanFrom.trim()) {
      return NextResponse.json({ error: 'Cannot move workspace root.' }, { status: 400 })
    }

    const cleanToDir = toDirectory.replaceAll('\\', '/').replace(/^\/+/, '')
    const fromPrefix = `${cleanFrom}/`

    if (cleanToDir === cleanFrom || cleanToDir.startsWith(fromPrefix)) {
      return NextResponse.json(
        { error: 'Cannot move an item into itself or its children.' },
        { status: 400 },
      )
    }

    const baseName = path.posix.basename(cleanFrom)
    const newRelative = cleanToDir ? path.posix.join(cleanToDir, baseName) : baseName

    if (newRelative === cleanFrom) {
      return NextResponse.json({ error: 'Already in that location.' }, { status: 400 })
    }

    const absFrom = resolveWorkspacePathApi(cleanFrom)
    const absTo = resolveWorkspacePathApi(newRelative)

    try {
      await fs.access(absTo)
      return NextResponse.json({ error: 'Destination already exists.' }, { status: 400 })
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
        throw e
      }
    }

    await fs.rename(absFrom, absTo)
    const stats = await fs.stat(absTo)
    const type = stats.isDirectory() ? 'directory' : 'file'

    return NextResponse.json({
      from: cleanFrom,
      to: newRelative,
      type,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to move' },
      { status: 400 },
    )
  }
}
