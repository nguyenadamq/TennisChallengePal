import { Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Challenge Court',
  description: 'Live tennis ladder management with friends, requests, and officer tools.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={sora.className}>{children}</body>
    </html>
  )
}
