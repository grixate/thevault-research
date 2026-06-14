import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../lib/utils";

export function Panel({ children, className, ...props }: ComponentPropsWithoutRef<"section"> & { children: ReactNode }) {
  return (
    <section className={cn("panel", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 title={title}>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </header>
  );
}
