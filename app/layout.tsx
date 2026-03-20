import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NeoHUDProvider } from '@/components/hud/NeoHUDContext'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AntiFault | Predictive Maintenance Platform',
  description: 'Industrial IoT AntiFault platform for predictive maintenance with 3D visualization, AI-powered diagnostics, and real-time machine health monitoring.',
  generator: 'v0.app',
  icons: {
    icon: '/transparent-logo.png',
    apple: '/transparent-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <NeoHUDProvider>
          {children}
          <Analytics />
        </NeoHUDProvider>
      </body>
    </html>
  )
}
