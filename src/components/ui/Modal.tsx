"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172026]/35 p-4">
      <section className="w-full max-w-lg rounded-lg border border-[#d9ded7] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#e6ebe4] px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" className="h-9 w-9 p-0" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </Button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
