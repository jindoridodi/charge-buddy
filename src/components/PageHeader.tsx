import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="border-b bg-gradient-hero">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 py-8 ${className}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${props.className ?? ""}`}
    />
  );
}
