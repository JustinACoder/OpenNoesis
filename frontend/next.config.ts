import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.js",
  },
};

export default nextConfig;
