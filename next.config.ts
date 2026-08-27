import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTNAMES } from "./src/lib/image-hosts";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTNAMES.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
};

export default nextConfig;
