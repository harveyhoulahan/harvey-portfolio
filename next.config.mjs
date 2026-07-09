/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // /skills merged into /about; keep old links and search results alive
    return [
      { source: "/skills", destination: "/about", permanent: true },
      { source: "/experience", destination: "/projects#timeline", permanent: true },
    ];
  },
};

export default nextConfig;
