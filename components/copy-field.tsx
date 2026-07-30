"use client";

import { useEffect, useState } from "react";

/**
 * Shows an absolute URL for a tokenized page and copies it in one click.
 *
 * The origin is read on the client so the same component works on localhost, on
 * a preview deployment, and in production without configuration.
 */
export function CopyField({ path }: { path: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const url = `${origin}${path}`;

  return (
    <div className="flex gap-1.5">
      <input readOnly value={url} className="input flex-1 text-xs" />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="btn-ghost btn-sm shrink-0"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
