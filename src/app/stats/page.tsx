"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/stats/StatCard";
import { LeadGrowthChart } from "@/components/stats/LeadGrowthChart";
import { SourcePieChart } from "@/components/stats/SourcePieChart";
import { mockStatsData } from "@/lib/mockData";
import { TimePeriod } from "@/types";
import { ChevronDown } from "lucide-react";

export default function StatsPage() {
  const [period, setPeriod] = useState<TimePeriod>("30");
  const stats = mockStatsData;

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <AppLayout title="Stats" subtitle="Welcome back, Heath">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Performance Overview</h2>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as TimePeriod)}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          change={calculateChange(stats.totalLeads, stats.previousPeriod.totalLeads)}
          type="leads"
        />
        <StatCard
          title="Emails Sent"
          value={stats.emailsSent}
          change={calculateChange(stats.emailsSent, stats.previousPeriod.emailsSent)}
          type="emails"
        />
        <StatCard
          title="Conversions"
          value={stats.conversions}
          change={calculateChange(stats.conversions, stats.previousPeriod.conversions)}
          type="conversions"
        />
        <StatCard
          title="Avg. Rate"
          value={stats.avgRate}
          change={calculateChange(stats.avgRate, stats.previousPeriod.avgRate)}
          type="rate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LeadGrowthChart data={stats.leadsTrend} />
        </div>
        <div>
          <SourcePieChart data={stats.sourceBreakdown} />
        </div>
      </div>
    </AppLayout>
  );
}
