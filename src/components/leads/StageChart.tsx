"use client";

import { Lead, LeadStage } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface StageChartProps {
  leads: Lead[];
}

const stageConfig: Record<LeadStage, { label: string; color: string }> = {
  contacted_1: { label: "Contacted 1", color: "#eab308" },
  contacted_2: { label: "Contacted 2", color: "#ec4899" },
  called: { label: "Called", color: "#a855f7" },
  not_interested: { label: "Not Interested", color: "#ef4444" },
  no_response: { label: "No Response", color: "#6b7280" },
  not_qualified: { label: "Not Qualified", color: "#475569" },
  interested: { label: "Interested", color: "#f97316" },
  onboarding_sent: { label: "Onboarding Sent", color: "#14b8a6" },
  converted: { label: "Converted", color: "#10b981" },
};

const stageOrder: LeadStage[] = ["contacted_1", "contacted_2", "called", "not_interested", "no_response", "not_qualified", "interested", "onboarding_sent", "converted"];

export function StageChart({ leads }: StageChartProps) {
  // Count leads by stage
  const stageCounts: Record<LeadStage, number> = {
    contacted_1: 0,
    contacted_2: 0,
    called: 0,
    not_interested: 0,
    no_response: 0,
    not_qualified: 0,
    interested: 0,
    onboarding_sent: 0,
    converted: 0,
  };

  leads.forEach((lead) => {
    if (stageCounts[lead.stage] !== undefined) {
      stageCounts[lead.stage]++;
    }
  });

  // Convert to chart data and sort by count (descending)
  const chartData = stageOrder
    .map((stage) => ({
      stage,
      label: stageConfig[stage].label,
      count: stageCounts[stage],
      color: stageConfig[stage].color,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Leads by Stage</h3>

      <div className="space-y-4">
        {chartData.map((item) => (
          <div key={item.stage} className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-700 text-right truncate">
              {item.label}
            </div>
            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all duration-500 ease-out"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: item.color,
                  minWidth: item.count > 0 ? "24px" : "0",
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-700">
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
            <p className="text-sm text-gray-500">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stageCounts.converted}</p>
            <p className="text-sm text-gray-500">Converted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {stageCounts.contacted_1 + stageCounts.contacted_2 + stageCounts.called + stageCounts.interested + stageCounts.onboarding_sent}
            </p>
            <p className="text-sm text-gray-500">In Pipeline</p>
          </div>
        </div>
      </div>
    </div>
  );
}
