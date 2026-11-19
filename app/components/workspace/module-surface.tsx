import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

function HeaderRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200/90 pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function HeaderContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 space-y-1", className)}>{children}</div>;
}

function HeaderEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold text-[#1B4D89] flex items-center gap-2 flex-wrap",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-[#B45309]"
      />
      {children}
    </p>
  );
}

function HeaderTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-lg sm:text-xl font-bold tracking-tight text-slate-900 text-balance",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function HeaderDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-slate-600 max-w-3xl leading-relaxed", className)}>
      {children}
    </p>
  );
}

function HeaderActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap shrink-0", className)}>
      {children}
    </div>
  );
}

export const ModuleHeader = {
  Root: HeaderRoot,
  Content: HeaderContent,
  Eyebrow: HeaderEyebrow,
  Title: HeaderTitle,
  Description: HeaderDescription,
  Actions: HeaderActions,
};

function MetricStripRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONE_ACCENTS: Record<"neutral" | "cobalt" | "amber" | "danger" | "emerald", string> = {
  neutral: "border-l-slate-400",
  cobalt: "border-l-[#1B4D89]",
  amber: "border-l-[#B45309]",
  danger: "border-l-rose-600",
  emerald: "border-l-emerald-600",
};

function MetricStripItem({
  label,
  value,
  hint,
  tone = "cobalt",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "cobalt" | "amber" | "danger" | "emerald";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-4 py-3 border-l-4 shadow-2xs",
        TONE_ACCENTS[tone],
      )}
    >
      <p className="text-xs font-medium text-slate-600 truncate">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 truncate">{hint}</p>}
    </div>
  );
}

export const MetricStrip = {
  Root: MetricStripRoot,
  Item: MetricStripItem,
};

export function EmptyStatePanel({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center space-y-2.5",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FB] text-[#1B4D89]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900 text-balance">{title}</h3>
      <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600">
        {description}
      </p>
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}
