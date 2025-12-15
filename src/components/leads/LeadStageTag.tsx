"use client";

import { useState, useRef, useEffect } from "react";
import { LeadStage } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface LeadStageTagProps {
  stage: LeadStage;
  editable?: boolean;
  onStageChange?: (newStage: LeadStage) => void;
}

const stageConfig: Record<LeadStage, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  },
  interested: {
    label: "Interested",
    className: "bg-green-100 text-green-700 hover:bg-green-200",
  },
  contacted: {
    label: "Contacted",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  demo: {
    label: "Demo",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  },
  converted: {
    label: "Converted",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  },
  lost: {
    label: "Lost",
    className: "bg-red-100 text-red-700 hover:bg-red-200",
  },
};

const stageOrder: LeadStage[] = ["new", "interested", "contacted", "negotiation", "demo", "converted", "lost"];

export function LeadStageTag({ stage, editable = false, onStageChange }: LeadStageTagProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = stageConfig[stage];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStageSelect = (newStage: LeadStage) => {
    if (onStageChange && newStage !== stage) {
      onStageChange(newStage);
    }
    setIsOpen(false);
  };

  if (!editable) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors",
          config.className
        )}
      >
        {config.label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
          {stageOrder.map((s) => {
            const sConfig = stageConfig[s];
            return (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageSelect(s);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      sConfig.className.split(" ")[0].replace("bg-", "bg-").replace("-100", "-500")
                    )}
                    style={{
                      backgroundColor: s === "new" ? "#3b82f6" :
                        s === "interested" ? "#22c55e" :
                        s === "contacted" ? "#eab308" :
                        s === "negotiation" ? "#f97316" :
                        s === "demo" ? "#a855f7" :
                        s === "converted" ? "#10b981" : "#ef4444"
                    }}
                  />
                  <span className="text-gray-700">{sConfig.label}</span>
                </div>
                {s === stage && <Check className="w-4 h-4 text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
