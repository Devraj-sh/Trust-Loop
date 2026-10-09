import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useJudgeMode } from "@/lib/trustloop/judge-mode";
import { ShieldAlert, Sparkles, Network, MapPin } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/review", label: "Returns" },
  { to: "/fraud-rings", label: "Fraud rings" },
  { to: "/risk-map", label: "Risk map" },
  { to: "/returns/new", label: "New return" },
  { to: "/upload", label: "Upload data" },
  { to: "/audit", label: "Audit trail" },
  { to: "/learning", label: "Model intelligence" },
] as const;

function TrustLoopLogo() {
  return (
    <Link to="/" className="flex items-center gap-2 group py-1" aria-label="TrustLoop home">
      <img
        src="/trustloop-logo.png"
        alt="TrustLoop — Smarter Returns. Safer Business."
        className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]"
      />
      <span className="hidden md:inline-block rounded bg-[#EAF3FF] text-[#1769E0] text-[9px] font-mono font-bold px-1.5 py-0.5 border border-[#BFDBFE] shadow-xs">
        TRUSTLOOP 2.0
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  fullWidthHero,
}: {
  children: ReactNode;
  fullWidthHero?: ReactNode;
}) {
  const { isJudgeMode, toggleJudgeMode } = useJudgeMode();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1F3A] flex flex-col selection:bg-[#BFDBFE]/60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#1769E0] focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Main Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white shadow-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <TrustLoopLogo />

          <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto py-1">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-[#1769E0] border-2 border-[#1769E0] shadow-[0_2px_0_0_#1769E0] font-bold"
                      : "text-slate-600 hover:text-[#0B1F3A] hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              to="/returns/new"
              search={{ scenario: "scenario-4-conflict" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs"
              title="Load Pre-configured Hero Fraud Ring Demo"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Fraud Ring Demo</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Full-width Hero Slot */}
      {fullWidthHero}

      {/* Main Content Area */}
      <main id="main" className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 sm:py-10 flex-1">
        {children}
      </main>

      {/* Enterprise Trust & Safety Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100 text-xs">
            <div className="flex items-center gap-3">
              <img
                src="/trustloop-logo.png"
                alt="TrustLoop"
                className="h-8 w-auto object-contain"
              />
              <span className="text-slate-500 font-medium">
                — Return Fraud Intelligence & Investigation Platform
              </span>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              ML Predicts · Evidence Explains · Graph Connects · Humans Verify
            </p>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              TrustLoop 2.0 combines pre-trained ML models, deterministic policy logic, customer behavior vectors, AI visual evidence, fraud ring relationship graphs, and regional return hotspot normalization.
            </p>
            <p className="font-mono text-[11px] text-slate-400 shrink-0">
              Graph Engine · Geo Centroid Normalization · XGBoost
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1769E0] font-mono">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-[#0B1F3A] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm text-slate-500 leading-relaxed sm:text-base">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
