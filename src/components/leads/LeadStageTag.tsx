"use client";

import { LeadStage } from "@/types";
import { cn } from "@/lib/utils";

interface LeadStageTagProps {
  stage: LeadStage;
}

const stageConfig: Record<LeadStage, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-blue-100 text-blue-700",
  },
  interested: {
    label: "Interested",
    className: "bg-green-100 text-green-700",
  },
  contacted: {
    label: "Contacted",
    className: "bg-yellow-100 text-yellow-700",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-orange-100 text-orange-700",
  },
  demo: {
    label: "Demo",
    className: "bg-purple-100 text-purple-700",
  },
  converted: {
    label: "Converted",
    className: "bg-emerald-100 text-emerald-700",
  },
  lost: {
    label: "Lost",
    className: "bg-red-100 text-red-700",
  },
};

export function LeadStageTag({ stage }: LeadStageTagProps) {
  const config = stageConfig[stage];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
