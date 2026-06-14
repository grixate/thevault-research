import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn("ui-input", className)} {...props} />;
}
