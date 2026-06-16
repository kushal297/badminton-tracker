"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const notConfigured = error.message === "SUPABASE_NOT_CONFIGURED";

  if (notConfigured) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <div className="text-4xl" aria-hidden>
          🏸
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold">Connect your database</h1>
        <p className="mt-2 text-sm text-muted">
          Badminton Tracker needs a free Supabase project to store games. Add your project URL and anon key to{" "}
          <code className="tnum rounded bg-court-soft px-1.5 py-0.5 text-court">.env.local</code>, then reload.
        </p>
        <div className="mt-5 rounded-xl border border-line bg-surface p-4 text-left text-sm">
          <p className="mb-2 font-medium">Quick start</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Create a project at supabase.com (free tier).</li>
            <li>
              Run <code className="text-court">supabase/schema.sql</code> in the SQL Editor.
            </li>
            <li>
              Copy the Project URL + anon key into <code className="text-court">.env.local</code>.
            </li>
          </ol>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-shuttle px-5 py-2.5 font-medium text-white"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">That action didn&apos;t go through. Try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-shuttle px-5 py-2.5 font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
