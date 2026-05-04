import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

const getWorkspaceRoot = () =>
  process.env.OPENMD_WORKSPACE ? path.resolve(process.env.OPENMD_WORKSPACE) : process.cwd()

const resolveWorkspacePath = (relativePath: string) => {
  const cleanPath = relativePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const root = getWorkspaceRoot()
  const resolvedPath = path.resolve(root, cleanPath)
  const relativeFromRoot = path.relative(root, resolvedPath)

  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw new Error('Path is outside the workspace.')
  }

  return resolvedPath
}

const mimeByExt: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get('path') ?? ''

  if (!relativePath.trim()) {
    return NextResponse.json({ error: 'Path is required.' }, { status: 400 })
  }

  try {
    const absolutePath = resolveWorkspacePath(relativePath)
    const stats = await fs.stat(absolutePath)

    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Not a file.' }, { status: 400 })
    }

    const buffer = await fs.readFile(absolutePath)
    const ext = path.extname(absolutePath).toLowerCase()
    const contentType = mimeByExt[ext] ?? 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read file.' },
      { status: 400 },
    )
  }
}
