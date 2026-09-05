import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import {
  areSentrySourceMapsConfigured,
  isHttpsDeploymentEnvironment,
  readNextBuildEnvironment,
} from "./src/lib/env";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const { NODE_ENV } = readNextBuildEnvironment();
const sentrySourceMapsConfigured = areSentrySourceMapsConfigured();
const httpsDeployment = isHttpsDeploymentEnvironment();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          allowDevelopmentEvaluator: NODE_ENV === "development",
          upgradeInsecureRequests: httpsDeployment,
        }),
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, nosnippet",
          },
        ],
      },
    ];
  },
  typedRoutes: true,
};

export default sentrySourceMapsConfigured
  ? withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      sourcemaps: { disable: false },
    })
  : nextConfig;
