import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Explicitly set Turbopack root to bypass workspace directory resolution issues on Windows
  // @ts-ignore
  turbopack: {
    root: path.join(__dirname, "."),
  },
  serverExternalPackages: ["puppeteer", "puppeteer-extra", "puppeteer-extra-plugin-stealth"]
};

export default nextConfig;
