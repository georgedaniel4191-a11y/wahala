"use client";

import { useEffect, useState } from "react";

/** Monotonic display clock anchored to the latest server snapshot. */
export function useServerClock(serverNow: string, deadlineAt: string | null) {
  const [sample, setSample] = useState({ anchor: serverNow, now: Date.parse(serverNow) });
  useEffect(() => {
    const server = Date.parse(serverNow);
    const received = performance.now();
    const timer = setInterval(() => setSample({ anchor: serverNow, now: server + performance.now() - received }), 250);
    return () => clearInterval(timer);
  }, [serverNow]);
  const now = sample.anchor === serverNow ? sample.now : Date.parse(serverNow);
  return { now, remaining: deadlineAt === null ? null : Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000)) };
}
