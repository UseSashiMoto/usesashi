/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    transpilePackages: ['sashi-ui'],
  },
  webpack: (config) => {
    config.node = {
      ...config.node,
      __dirname: true,
    };
    return config;
  },
};

module.exports = nextConfig;
