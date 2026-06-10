import { db } from "@/lib/db/indexeddb";
import type { ImportedPdf } from "@/types/study";

export async function listImportedPdfs(): Promise<ImportedPdf[]> {
  return db.importedPdfs.orderBy("updatedAt").reverse().toArray();
}

export async function saveImportedPdf(pdf: ImportedPdf): Promise<void> {
  await db.importedPdfs.put(pdf);
}

export async function deleteImportedPdf(id: string): Promise<void> {
  await db.importedPdfs.delete(id);
}
