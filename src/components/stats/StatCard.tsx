"use client";

import { cn } from "@/lib/utils";
import { Users, Mail, TrendingUp, BarChart3, ArrowUp, ArrowDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change: number;
  type: "leads" | "emails" | "conversions" | "rate";
}

const iconMap = {
  leads: Users,
  emails: Mail,
  conversions: TrendingUp,
  rate: BarChart3,
};

const colorMap = {
  leads: "text-green-500 bg-green-50",
  emails: "text-blue-500 bg-blue-50",
  conversions: "text-purple-500 bg-purple-50",
  rate: "text-orange-500 bg-orange-50",
};

export function StatCard({ title, value, change, type }: StatCardProps) {
  const Icon = iconMap[type];
  const isPositive = change >= 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === "number" && type === "rate" ? `${value}%` : value}
          </p>
        </div>
        <div className={cn("p-2 rounded-lg", colorMap[type])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        {isPositive ? (
          <ArrowUp className="w-4 h-4 text-green-500" />
        ) : (
          <ArrowDown className="w-4 h-4 text-red-500" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            isPositive ? "text-green-500" : "text-red-500"
          )}
        >
          {Math.abs(change)}%
        </span>
        <span className="text-sm text-gray-500">vs previous period</span>
      </div>
    </div>
  );
}
