"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Try again</button>
          <Link href="/" className="rounded-md border px-4 py-2">Go home</Link>
        </div>
      </div>
    </div>
  );
}
