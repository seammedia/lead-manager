"use client";

import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/stats/StatCard";
import { LeadGrowthChart } from "@/components/stats/LeadGrowthChart";
import { mockStatsData, mockLeads, getTopOpportunities } from "@/lib/mockData";
import { getInitials, getAvatarColor } from "@/lib/utils";
import { LeadStageTag } from "@/components/leads/LeadStageTag";
import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

export default function DashboardPage() {
  const stats = mockStatsData;
  const topOpportunities = getTopOpportunities(mockLeads).slice(0, 3);
  const recentLeads = mockLeads.slice(0, 5);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <AppLayout title="Dashboard" subtitle="Welcome back, Keanu">
      {/* Quick Stats */}
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
        {/* Lead Growth Chart */}
        <div className="lg:col-span-2">
          <LeadGrowthChart data={stats.leadsTrend} />
        </div>

        {/* Top Opportunities */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Top Opportunities</h3>
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <Link
              href="/leads"
              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {topOpportunities.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div
                  className={`w-10 h-10 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-medium text-sm`}
                >
                  {getInitials(lead.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{lead.name}</p>
                  <p className="text-sm text-gray-500 truncate">{lead.company}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    {lead.conversion_probability}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Leads</h3>
          <Link
            href="/leads"
            className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {recentLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-medium text-sm`}
                >
                  {getInitials(lead.name)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{lead.name}</p>
                  <p className="text-sm text-gray-500">{lead.company}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <LeadStageTag stage={lead.stage} />
                <span className="text-sm text-gray-500 capitalize">{lead.source}</span>
                <span className="text-sm text-gray-500">{lead.owner}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
