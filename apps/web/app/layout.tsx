import { Geist, Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'

import '@workspace/ui/globals.css'
import '@xterm/xterm/css/xterm.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@workspace/ui/lib/utils'

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
const terminalFont = localFont({
  src: '../../fonts/MesloLGS NF Regular.ttf',
  variable: '--font-terminal',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'antialiased',
        fontSans.variable,
        'font-mono',
        geistMono.variable,
        terminalFont.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
