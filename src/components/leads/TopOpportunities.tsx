"use client";

import { Lead } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";
import { Flame } from "lucide-react";

interface TopOpportunitiesProps {
  leads: Lead[];
}

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return "bg-green-500";
  if (probability >= 40) return "bg-yellow-500";
  return "bg-blue-500";
}

export function TopOpportunities({ leads }: TopOpportunitiesProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Top Opportunities</h2>
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <span className="text-sm text-gray-500">Highest conversion probability</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="flex-shrink-0 w-[140px] p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="relative flex justify-center mb-3">
              <div
                className={`w-16 h-16 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-semibold text-lg`}
              >
                {getInitials(lead.name)}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 ${getProbabilityColor(lead.conversion_probability)} text-white text-xs font-bold px-2 py-0.5 rounded-full`}
              >
                {lead.conversion_probability}%
              </div>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 text-sm truncate">{lead.name}</p>
              <p className="text-xs text-gray-500 truncate">{lead.company}</p>
            </div>
          </div>
        ))}
        <div className="flex-shrink-0 w-[140px] p-4 border border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all">
          <span className="text-2xl text-gray-400">+</span>
        </div>
      </div>
    </div>
  );
}
