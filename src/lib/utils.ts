import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatRelativeTime(date: Date | string): {
  text: string;
  colorClass: string;
} {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  let colorClass: string;

  if (diffMins < 60) {
    text = diffMins <= 1 ? "just now" : `${diffMins} mins ago`;
    colorClass = "text-green-600";
  } else if (diffHours < 24) {
    text = diffHours === 1 ? "1 hr ago" : `${diffHours} hrs ago`;
    colorClass = "text-green-600";
  } else if (diffDays === 1) {
    text = "1 day ago";
    colorClass = "text-green-600";
  } else if (diffDays === 2) {
    text = "2 days ago";
    colorClass = "text-orange-500";
  } else if (diffDays === 3) {
    text = "3 days ago";
    colorClass = "text-orange-600";
  } else {
    text = `${diffDays} days ago`;
    colorClass = "text-red-500";
  }

  return { text, colorClass };
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarColor(name: string): string {
  const colors = [
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}
