import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prode Las Últimas Dos',
  description: 'Prode para cargar pronósticos y ver ranking',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body style={{ background: '#0f172a' }}>
        {children}
      </body>
    </html>
  )
}