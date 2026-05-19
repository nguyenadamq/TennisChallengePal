import { Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Tennis Challenge Pal',
  description: 'Club ladders, friends, notifications, and tennis court finder tools.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={sora.className}>{children}</body>
    </html>
  )
}
