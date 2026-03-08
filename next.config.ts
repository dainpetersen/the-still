import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kentuckypeerless.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "shop.penelopebourbon.com",
        pathname: "/cdn/shop/**",
      },
      {
        protocol: "https",
        hostname: "redwoodempirewhiskey.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
