import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Existing
      { protocol: "https", hostname: "kentuckypeerless.com", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "shop.penelopebourbon.com", pathname: "/cdn/shop/**" },
      { protocol: "https", hostname: "redwoodempirewhiskey.com", pathname: "/wp-content/uploads/**" },
      // Four Roses
      { protocol: "https", hostname: "four-roses.files.svdcdn.com", pathname: "/production/**" },
      // Wild Turkey
      { protocol: "https", hostname: "www.wildturkeybourbon.com", pathname: "/app/uploads/**" },
      // Woodford Reserve
      { protocol: "https", hostname: "www.woodfordreserve.com", pathname: "/wp-content/uploads/**" },
      // Old Forester
      { protocol: "https", hostname: "www.oldforester.com", pathname: "/wp-content/uploads/**" },
      // Michter's
      { protocol: "https", hostname: "michters.com", pathname: "/wp-content/uploads/**" },
      // Elijah Craig
      { protocol: "https", hostname: "www.elijahcraig.com", pathname: "/images/**" },
      // Larceny
      { protocol: "https", hostname: "www.larcenybourbon.com", pathname: "/images/**" },
      // Sagamore Spirit
      { protocol: "https", hostname: "sagamorespirit.com", pathname: "/wp-content/uploads/**" },
      // Bardstown Bourbon Company
      { protocol: "https", hostname: "www.bardstownbourbon.com", pathname: "/wp-content/uploads/**" },
      // Still Austin (Webflow CDN)
      { protocol: "https", hostname: "cdn.prod.website-files.com", pathname: "/**" },
      // Holladay Distillery
      { protocol: "https", hostname: "holladaybourbon.com", pathname: "/wp-content/uploads/**" },
      // Basil Hayden's
      { protocol: "https", hostname: "www.basilhaydenbourbon.com", pathname: "/sites/default/**" },
      // Knob Creek
      { protocol: "https", hostname: "www.knobcreek.com", pathname: "/sites/default/**" },
      // Beam Suntory (Booker's, Baker's)
      { protocol: "https", hostname: "www.beamdistilling.com", pathname: "/sites/default/**" },
      // High West
      { protocol: "https", hostname: "ship.highwest.com", pathname: "/cdn/shop/**" },
    ],
  },
};

export default nextConfig;
