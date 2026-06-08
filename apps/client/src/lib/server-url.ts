export type NormalizeServerUrlResult = {
  url: string
  hint: string | null
}

const ensureHttpScheme = (value: string) => {
  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `http://${value}`
}

export const normalizeServerUrl = (input: string): NormalizeServerUrlResult => {
  const trimmed = input.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('Server URL is required.')
  }

  let parsed: URL

  try {
    parsed = new URL(ensureHttpScheme(trimmed))
  } catch {
    throw new Error('Enter a valid server address, for example 127.0.0.1:8787.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Server address must use HTTP or HTTPS.')
  }

  if (!parsed.hostname) {
    throw new Error('Server URL must include a host.')
  }

  let hint: string | null = null

  if (parsed.hostname === '0.0.0.0') {
    parsed.hostname = '127.0.0.1'
    hint =
      '0.0.0.0 is only a bind address. Connecting locally via 127.0.0.1 instead. From another computer, use this machine\'s LAN IP (for example 192.168.1.20:8787).'
  }

  if (parsed.hostname === 'localhost') {
    parsed.hostname = '127.0.0.1'
    hint = 'Using 127.0.0.1 instead of localhost for desktop compatibility.'
  }

  const port = parsed.port ? `:${parsed.port}` : ''
  const url = `${parsed.protocol}//${parsed.hostname}${port}`

  return { url, hint }
}
