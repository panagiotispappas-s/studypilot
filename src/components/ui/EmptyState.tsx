import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfd8d2] bg-white px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-[#18202f]">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
