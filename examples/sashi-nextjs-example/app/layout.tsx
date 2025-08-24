export const metadata = {
  title: 'Sashi Next.js Example',
  description: 'Example Next.js app with Sashi integration using App Router',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}