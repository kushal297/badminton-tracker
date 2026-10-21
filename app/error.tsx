"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Production masks server error messages; the digest matches the server log.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">Something went wrong loading this page. Try again.</p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-shuttle px-5 py-2.5 font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
