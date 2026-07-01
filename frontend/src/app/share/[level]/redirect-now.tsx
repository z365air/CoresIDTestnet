"use client";

import { useEffect, useState } from "react";

export function RedirectNow({ to }: { to: string }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (count === 0) {
      window.location.replace(to);
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, to]);
  return <p className="mt-4 text-sm text-white/60">Redirecting in {count}s...</p>;
}
