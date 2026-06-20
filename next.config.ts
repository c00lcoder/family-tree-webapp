import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// When building the static bundle that Capacitor wraps, set CAPACITOR_BUILD=1.
// That produces a fully static export (no server) that runs inside the native
// shell and talks to the hosted API over HTTPS.
const isCapacitor = process.env.CAPACITOR_BUILD === "1";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  ...(isCapacitor ? { output: "export" } : {}),
  images: {
    // Allow R2 / generic S3-compatible public hosts for person photos & icons.
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
    // Static export can't use the Next image optimizer.
    unoptimized: isCapacitor,
  },
};

export default withPWA(nextConfig);
