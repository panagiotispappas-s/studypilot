import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/utils/format";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ className, variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-[#2f6f73] text-white hover:bg-[#285d61]",
        variant === "secondary" && "border border-[#d9ded7] bg-white text-[#18202f] hover:bg-[#eef3ee]",
        variant === "ghost" && "text-[#334155] hover:bg-[#edf1ec]",
        variant === "danger" && "bg-[#b54747] text-white hover:bg-[#923a3a]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
