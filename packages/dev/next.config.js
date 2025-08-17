/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['sashi-ui', 'sashi-lib', '@sashimo/ui', '@sashimo/lib'],


  webpack: (config) => {
    config.node = {
      ...config.node,
      __dirname: true,
    };
    return config;
  },
};

module.exports = nextConfig;
