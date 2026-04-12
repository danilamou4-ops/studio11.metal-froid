import * as React from "react";

import { cn } from "@/lib/utils";

type ViewStateVariant = "loading" | "empty" | "success" | "error" | "info";

const toneByVariant: Record<ViewStateVariant, string> = {
  loading: "border-border bg-secondary/40 text-muted-foreground",
  empty: "border-border bg-secondary/40 text-muted-foreground",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-primary/30 bg-primary/10 text-foreground",
};

export interface ViewStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ViewStateVariant;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function ViewState({
  variant = "info",
  title,
  description,
  action,
  className,
  children,
  ...props
}: ViewStateProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border px-4 py-3",
        toneByVariant[variant],
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
      {...props}
    >
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      {description ? <p className={cn("text-sm", title ? "mt-1" : undefined)}>{description}</p> : null}
      {children ? <div className={cn((title || description) ? "mt-2" : undefined)}>{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
