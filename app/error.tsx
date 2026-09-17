"use client";

import { useEffect } from "react";

// Route-level error boundary. Without this, ANY uncaught error anywhere in
// the app (a bad data shape, a flaky network call, etc.) fell through to
// Next.js's generic blank "Application error" page with no way to recover
// except a hard reload. This catches it, shows a friendly message, and lets
// the person try again in place.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="card max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-clay/10 text-clay flex items-center justify-center text-2xl mx-auto mb-3">
          !
        </div>
        <h2 className="font-display text-lg font-semibold text-ink mb-1">Something went wrong</h2>
        <p className="text-sm text-ink/60 mb-5">
          That didn&apos;t load correctly. Your data is safe - just try again.
        </p>
        <button onClick={() => reset()} className="btn-primary w-full">
          Try again
        </button>
      </div>
    </div>
  );
}
