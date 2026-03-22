import './globals.css'

export const metadata = {
  title: 'Tennis Challenge Pal',
  description: 'Live tennis ladder management with friends, requests, and officer tools.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
