import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(
  given?: string | null,
  surname?: string | null,
): string {
  return [given, surname].filter(Boolean).join(" ").trim() || "Unknown";
}
