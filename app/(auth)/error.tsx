"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist/30 px-4">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-bold text-ink mb-2">Authentication error</h2>
        <p className="text-ink/60 mb-6 text-sm">
          Something went wrong during sign in. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-lagoon hover:bg-lagoon/90 text-white font-medium py-2.5 px-5 rounded-xl transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
