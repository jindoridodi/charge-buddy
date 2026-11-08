"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { MapViewProps } from "./MapView.client";

const Inner = dynamic(() => import("./MapView.client"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

class MapBoundary extends Component<{ children: ReactNode; onError?: (() => void) | undefined }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onError?.(); }
  override render() { return this.state.failed ? <p role="status">Map unavailable. Use the charger list instead.</p> : this.props.children; }
}

export function MapView({ onError, ...props }: MapViewProps & { onError?: () => void }) {
  return <MapBoundary onError={onError}><Inner {...props} /></MapBoundary>;
}

