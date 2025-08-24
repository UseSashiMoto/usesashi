/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable app directory for App Router example
    appDir: true,
  },
  env: {
    // Make environment variables available to the client
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
}

module.exports = nextConfig