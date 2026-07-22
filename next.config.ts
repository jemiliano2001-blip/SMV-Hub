import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Admin SDK external. Deploys must use scripts/firebase-deploy.mjs
  // (forces --webpack) until firebase-tools#9761 lands; Turbopack hashes
  // firebase-admin and breaks SSR. Also reuse the named admin app from
  // firebase-frameworks in lib/firebase-admin.ts.
  serverExternalPackages: ["firebase-admin", "firebase-functions"],
};

export default nextConfig;
