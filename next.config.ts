import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // The browser talks to Supabase through this same-origin path; the Next
  // server proxies it on. One origin for everything — no third-party requests
  // from the client, and environments where the browser can't reach Supabase
  // directly (locked-down networks, CI sandboxes) still work.
  async rewrites() {
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabase) return [];
    return [{ source: "/supa/:path*", destination: `${supabase}/:path*` }];
  },
};

export default nextConfig;
