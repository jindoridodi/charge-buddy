"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/lib/store";
import { SiteHeader, SiteFooter } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <Toaster richColors position="top-center" />
    </AppProvider>
  );
}
