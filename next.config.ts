import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hmnrecnxwxqlbwudozdo.supabase.co",
      },
    ],
  },
};

export default nextConfig;