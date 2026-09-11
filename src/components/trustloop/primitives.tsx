import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_3px_0_0_#E2E8F0,0_8px_24px_-4px_rgba(11,31,58,0.08),0_1px_3px_rgba(11,31,58,0.04)] transition-all hover:shadow-[0_5px_0_0_#CBD5E1,0_16px_32px_-4px_rgba(11,31,58,0.12)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="font-display text-base font-bold tracking-tight text-[#0B1F3A]">{title}</h2>
            )}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function OutlinePanel({
  title,
  description,
  children,
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-[#F7F9FC]/80 p-4 sm:p-5 shadow-[0_2px_0_0_#E2E8F0]",
        className,
      )}
    >
      {title && (
        <header className="mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function IconContainer({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: "blue" | "cyan" | "green" | "amber" | "red" | "navy";
  className?: string;
}) {
  const tones = {
    blue: "bg-[#EAF3FF] text-[#1769E0] border-[#BFDBFE]",
    cyan: "bg-[#E0F8FB] text-[#00A8C6] border-[#B2EBF2]",
    green: "bg-[#E8F8F2] text-[#12A878] border-[#A7F3D0]",
    amber: "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]",
    red: "bg-[#FEE2E2] text-[#E5484D] border-[#FECACA]",
    navy: "bg-[#0B1F3A] text-white border-[#0B1F3A]",
  };

  return (
    <div
      className={cn(
        "grid size-10 place-items-center rounded-xl border shadow-[0_2px_0_0_rgba(11,31,58,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_rgba(11,31,58,0.15)]",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_0_0_#E2E8F0,0_6px_16px_-2px_rgba(11,31,58,0.06)] transition-all hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-[0_5px_0_0_#93C5FD,0_12px_22px_-2px_rgba(23,105,224,0.14)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
          {label}
        </p>
        {icon && <div className="text-[#1769E0]">{icon}</div>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A] tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const toneClasses = {
  positive: "bg-white text-[#0D7B57] border-2 border-[#12A878] shadow-[0_2px_0_0_#12A878] font-bold",
  caution: "bg-white text-[#B45309] border-2 border-[#F59E0B] shadow-[0_2px_0_0_#D97706] font-bold",
  critical: "bg-white text-[#DC2626] border-2 border-[#E5484D] shadow-[0_2px_0_0_#DC2626] font-bold",
  neutral: "bg-white text-slate-700 border border-slate-300 shadow-[0_2px_0_0_#CBD5E1] font-semibold",
  brand: "bg-white text-[#1769E0] border-2 border-[#1769E0] shadow-[0_2px_0_0_#1769E0] font-bold",
  cyan: "bg-white text-[#007A94] border-2 border-[#00B8D9] shadow-[0_2px_0_0_#00A8C6] font-bold",
} as const;

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof toneClasses | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Meter({
  value,
  tone = "brand",
}: {
  value: number;
  tone?: "brand" | "positive" | "caution" | "critical" | "cyan";
}) {
  const bar = {
    brand: "bg-[#1769E0]",
    positive: "bg-[#12A878]",
    caution: "bg-[#F59E0B]",
    critical: "bg-[#E5484D]",
    cyan: "bg-[#00B8D9]",
  }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", bar)}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function riskTone(level: string): "positive" | "caution" | "critical" {
  return level === "HIGH" ? "critical" : level === "MEDIUM" ? "caution" : "positive";
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center shadow-xs">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1769E0]">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-sm font-bold text-[#0B1F3A]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
