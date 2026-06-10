"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, HardDrive, ShieldCheck, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db/indexeddb";
import { downloadText } from "@/lib/utils/format";
import type { ImportedPdf } from "@/types/study";

type ExportPayload = Partial<{
  folders: never[];
  notebooks: never[];
  pages: never[];
  elements: never[];
  importedPdfs: never[];
  flashcards: never[];
  quizQuestions: never[];
  generations: never[];
  profiles: never[];
}>;

export function SettingsView() {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [pdfs, setPdfs] = useState<ImportedPdf[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    setPdfs(await db.importedPdfs.orderBy("updatedAt").reverse().toArray());
  }

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, []);

  async function exportAll() {
    const [folders, notebooks, pages, elements, importedPdfs, flashcards, quizQuestions, generations, profiles] = await Promise.all([
      db.folders.toArray(),
      db.notebooks.toArray(),
      db.pages.toArray(),
      db.pageElements.toArray(),
      db.importedPdfs.toArray(),
      db.flashcards.toArray(),
      db.quizQuestions.toArray(),
      db.generations.toArray(),
      db.profiles.toArray(),
    ]);
    downloadText(
      "studypilot-export.json",
      JSON.stringify({ folders, notebooks, pages, elements, importedPdfs, flashcards, quizQuestions, generations, profiles }, null, 2),
      "application/json",
    );
  }

  async function importAll(file: File) {
    const parsed = JSON.parse(await file.text()) as ExportPayload;
    await db.transaction(
      "rw",
      [db.folders, db.notebooks, db.pages, db.pageElements, db.importedPdfs, db.flashcards, db.quizQuestions, db.generations, db.profiles],
      async () => {
        if (parsed.folders) await db.folders.bulkPut(parsed.folders);
        if (parsed.notebooks) await db.notebooks.bulkPut(parsed.notebooks);
        if (parsed.pages) await db.pages.bulkPut(parsed.pages);
        if (parsed.elements) await db.pageElements.bulkPut(parsed.elements);
        if (parsed.importedPdfs) await db.importedPdfs.bulkPut(parsed.importedPdfs);
        if (parsed.flashcards) await db.flashcards.bulkPut(parsed.flashcards);
        if (parsed.quizQuestions) await db.quizQuestions.bulkPut(parsed.quizQuestions);
        if (parsed.generations) await db.generations.bulkPut(parsed.generations);
        if (parsed.profiles) await db.profiles.bulkPut(parsed.profiles);
      },
    );
    setMessage("Import abgeschlossen.");
    await refresh();
  }

  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="Lokale Speicherung, Export und Vorbereitung für spätere Synchronisation." />
      <div className="grid gap-5 px-5 py-6 lg:grid-cols-3 lg:px-8">
        <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
          <HardDrive className="text-[#2f6f73]" size={24} />
          <h2 className="mt-4 font-semibold">Lokaler Speicher</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            StudyPilot speichert Notizen, Seitenelemente, Zeichnungen, Kommentare, Karteikarten, Quizfragen und PDFs in IndexedDB dieses Browsers.
          </p>
        </section>
        <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
          <ShieldCheck className="text-[#2f6f73]" size={24} />
          <h2 className="mt-4 font-semibold">Accountfähig vorbereitet</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Die Datenmodelle enthalten StudyPilot-eigene Nutzerfelder, damit Auth, Supabase und Synchronisation später getrennt ergänzt werden können.
          </p>
        </section>
        <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
          <Download className="text-[#2f6f73]" size={24} />
          <h2 className="mt-4 font-semibold">Export und Import</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">Sichere oder übernehme lokal gespeicherte StudyPilot-Inhalte als JSON-Datei.</p>
          <Button className="mt-4" variant="secondary" onClick={exportAll}>
            <Download size={16} />
            Alles exportieren
          </Button>
          <Button className="mt-2" variant="secondary" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            JSON importieren
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importAll(file);
              event.currentTarget.value = "";
            }}
          />
        </section>
      </div>
      <section className="mx-5 mb-8 rounded-lg border border-[#dfe6df] bg-white p-5 lg:mx-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Importierte PDFs</h2>
            <p className="mt-1 text-sm text-[#667085]">PDFs, die im Editor gespeichert wurden, bleiben lokal verfügbar.</p>
          </div>
          <FileText className="text-[#2f6f73]" size={22} />
        </div>
        {pdfs.length === 0 ? (
          <p className="mt-4 text-sm text-[#667085]">Noch keine PDFs importiert.</p>
        ) : (
          <div className="mt-4 divide-y divide-[#edf1ec]">
            {pdfs.map((pdf) => (
              <div key={pdf.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-medium">{pdf.name}</span>
                  <span className="text-[#667085]">{pdf.pageCount} Seiten · {Math.round(pdf.size / 1024)} KB</span>
                </span>
                <a href={pdf.dataUrl} target="_blank" rel="noreferrer" className="font-medium text-[#2f6f73]">Öffnen</a>
              </div>
            ))}
          </div>
        )}
        {message ? <p className="mt-4 rounded-md bg-[#eef8f5] px-3 py-2 text-sm text-[#1f5f61]">{message}</p> : null}
      </section>
    </div>
  );
}
