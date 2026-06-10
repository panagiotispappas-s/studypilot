import { AppShell } from "@/components/layout/AppShell";
import { NotebookEditor } from "@/components/editor/NotebookEditor";

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <NotebookEditor notebookId={id} />
    </AppShell>
  );
}
