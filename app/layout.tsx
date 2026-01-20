import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })

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
      <body className={`${_inter.variable} ${_jetbrainsMono.variable} font-mono antialiased overflow-hidden`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
