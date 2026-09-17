"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown by the root layout itself, which
// app/error.tsx cannot catch. This must render its own <html>/<body> since
// it replaces the whole page when it fires. Kept dependency-free (no
// Tailwind classes guaranteed to be loaded) and inlines its own styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F6F2EC" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              background: "white",
              border: "1px solid #E4DED2",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 2px 8px rgba(28,35,33,0.06)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1C2321", marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: "#6b6156", marginBottom: 20 }}>
              That didn&apos;t load correctly. Your data is safe - just try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                width: "100%",
                background: "#1D7874",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
