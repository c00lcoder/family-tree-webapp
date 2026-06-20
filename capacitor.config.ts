import type { CapacitorConfig } from "@capacitor/cli";

// The native shell loads the static export from `out/` (built with
// CAPACITOR_BUILD=1). API calls go to the hosted deployment over HTTPS.
const config: CapacitorConfig = {
  appId: "ai.destined.familytree",
  appName: "Family Tree",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
