"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView.client";

const Inner = dynamic(() => import("./MapView.client"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapView(props: MapViewProps) {
  return <Inner {...props} />;
}
