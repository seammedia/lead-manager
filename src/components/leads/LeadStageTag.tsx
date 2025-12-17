"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { LeadStage } from "@/types";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface LeadStageTagProps {
  stage: LeadStage;
  editable?: boolean;
  onStageChange?: (newStage: LeadStage) => void;
}

const stageConfig: Record<LeadStage, { label: string; className: string; dotColor: string }> = {
  contacted_1: {
    label: "Contacted 1",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    dotColor: "#eab308",
  },
  contacted_2: {
    label: "Contacted 2",
    className: "bg-pink-100 text-pink-700 hover:bg-pink-200",
    dotColor: "#ec4899",
  },
  called: {
    label: "Called",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    dotColor: "#a855f7",
  },
  not_interested: {
    label: "Not Interested",
    className: "bg-red-100 text-red-700 hover:bg-red-200",
    dotColor: "#ef4444",
  },
  no_response: {
    label: "No Response",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    dotColor: "#6b7280",
  },
  not_qualified: {
    label: "Not Qualified",
    className: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    dotColor: "#475569",
  },
  interested: {
    label: "Interested",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-200",
    dotColor: "#f97316",
  },
  onboarding_sent: {
    label: "Onboarding Sent",
    className: "bg-teal-100 text-teal-700 hover:bg-teal-200",
    dotColor: "#14b8a6",
  },
  converted: {
    label: "Converted",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    dotColor: "#10b981",
  },
};

const stageOrder: LeadStage[] = ["contacted_1", "contacted_2", "called", "not_interested", "no_response", "not_qualified", "interested", "onboarding_sent", "converted"];

export function LeadStageTag({ stage, editable = false, onStageChange }: LeadStageTagProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = stageConfig[stage];

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

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

  const dropdown = isOpen && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
    >
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
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sConfig.dotColor }}
              />
              <span className="text-gray-700">{sConfig.label}</span>
            </div>
            {s === stage && <Check className="w-4 h-4 text-green-500" />}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
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
      {dropdown}
    </>
  );
}
