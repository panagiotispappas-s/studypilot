import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-sm text-[#667085]">Lade Bibliothek...</div>}>
        <LibraryView />
      </Suspense>
    </AppShell>
  );
}
