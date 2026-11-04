import { Compass, FileText, House, LampDesk, ScanLine } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { PropertiesProvider } from "@/state/properties.tsx";
import { SensorsProvider } from "@/state/sensors.tsx";
import { CheckView } from "@/views/CheckView.tsx";
import { CompassView } from "@/views/CompassView.tsx";
import { HomesView } from "@/views/HomesView.tsx";
import { ReportView } from "@/views/ReportView.tsx";
import { ScanView } from "@/views/ScanView.tsx";

type ViewId = "compass" | "check" | "scan" | "homes" | "report";

const NAV: { id: ViewId; label: string; icon: typeof Compass }[] = [
  { id: "compass", label: "North", icon: Compass },
  { id: "check", label: "Check", icon: LampDesk },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "homes", label: "Homes", icon: House },
  { id: "report", label: "Report", icon: FileText },
];

export default function App() {
  return (
    <PropertiesProvider>
      <SensorsProvider>
        <Shell />
      </SensorsProvider>
    </PropertiesProvider>
  );
}

function Shell() {
  const [view, setView] = useState<ViewId>("compass");
  return (
    <div className="min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <main id="content" className="px-4 pt-5 pb-36 sm:px-6">
        {view === "compass" && <CompassView />}
        {view === "check" && <CheckView />}
        {view === "scan" && <ScanView />}
        {view === "homes" && <HomesView onOpen={setView} />}
        {view === "report" && <ReportView onScan={() => setView("scan")} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-lg items-stretch justify-between rounded-full border border-border bg-card/95 px-1 py-1 shadow-[0_12px_40px_-18px_rgba(70,40,10,0.65)] backdrop-blur">
          {NAV.map((item) => {
            const Icon = item.icon;
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[0.65rem] font-medium",
                  selected ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
