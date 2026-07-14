import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Hosting's framework builder uses Turbopack. Keep the Admin SDK
  // as a runtime dependency so Turbopack does not emit hashed aliases that
  // the generated SSR function cannot resolve in production.
  serverExternalPackages: ["firebase-admin", "firebase-functions"],
};

export default nextConfig;
