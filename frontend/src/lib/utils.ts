import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Compact relative time ("Just now", "5 min", "3 hrs", "2 days") for
// notification / review-queue timestamps. Mirrors the older local `formatAge`
// helpers in the dashboard components.
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr${hours !== 1 ? "s" : ""}`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? "s" : ""}`
}
