/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    transpilePackages: [],
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
