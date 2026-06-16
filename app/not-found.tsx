import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-4xl" aria-hidden>
        🏸
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold">Out of bounds</h1>
      <p className="mt-2 text-sm text-muted">That page isn&apos;t here.</p>
      <Link href="/" className={`${btnPrimary} mt-5`}>
        Back to the court
      </Link>
    </div>
  );
}
