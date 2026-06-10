import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LearningCenter } from "@/components/learning/LearningCenter";

export default function LearnPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-sm text-[#667085]">Lade Lernzentrale...</div>}>
        <LearningCenter />
      </Suspense>
    </AppShell>
  );
}
