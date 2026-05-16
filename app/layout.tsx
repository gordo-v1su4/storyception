import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "STORYCEPTION | Cinematic Story Engine",
  description: "AI-Powered Cinematic Storytelling Tool",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-mono antialiased overflow-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
