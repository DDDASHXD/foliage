const isTauriBuild = process.env.TAURI_BUILD === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/ui'],
  serverExternalPackages: ['@skxv/leafmark'],
  ...(isTauriBuild
    ? {
        output: 'export',
        images: { unoptimized: true },
      }
    : {}),
}

export default nextConfig
