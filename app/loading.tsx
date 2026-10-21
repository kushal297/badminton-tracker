import { Card } from "@/components/ui";

const bar = "rounded bg-line";

// Shown at once on navigation while a force-dynamic page streams in.
// A root loading.tsx wraps every nested page in a Suspense boundary.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="motion-safe:animate-pulse">
      <div className="mb-5">
        <div className={`${bar} h-8 w-40`} />
        <div className={`${bar} mt-0.5 h-5 w-56`} />
        <div className="court-rule mt-3" />
      </div>
      <div className="space-y-3">
        {[3, 2, 3].map((rows, i) => (
          <Card key={i} className="space-y-3 p-4">
            {Array.from({ length: rows }, (_, j) => (
              <div key={j} className={`${bar} h-4 ${j === 0 ? "w-2/3" : "w-full"}`} />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
