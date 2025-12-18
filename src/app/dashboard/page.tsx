"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/stats/StatCard";
import { LeadGrowthChart } from "@/components/stats/LeadGrowthChart";
import { getInitials, getAvatarColor } from "@/lib/utils";
import { LeadStageTag } from "@/components/leads/LeadStageTag";
import { Lead } from "@/types";
import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

interface StatsData {
  totalLeads: number;
  emailsSent: number;
  conversions: number;
  convRate: number;
  previousPeriod: {
    totalLeads: number;
    emailsSent: number;
    conversions: number;
    convRate: number;
  };
  leadsTrend: { week: string; leads: number; conversions: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, leadsRes] = await Promise.all([
          fetch("/api/stats?days=30"),
          fetch("/api/leads?archived=false"),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          setLeads(leadsData.leads || []);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Get top opportunities (highest conversion probability)
  const topOpportunities = [...leads]
    .filter((l) => l.stage !== "converted" && l.stage !== "not_interested")
    .sort((a, b) => b.conversion_probability - a.conversion_probability)
    .slice(0, 3);

  // Get recent leads (most recently created)
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <AppLayout title="Dashboard" subtitle="Welcome back, Heath">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-400">Loading dashboard...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard" subtitle="Welcome back, Heath">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          change={calculateChange(stats?.totalLeads || 0, stats?.previousPeriod.totalLeads || 0)}
          type="leads"
        />
        <StatCard
          title="Emails Sent"
          value={stats?.emailsSent || 0}
          change={calculateChange(stats?.emailsSent || 0, stats?.previousPeriod.emailsSent || 0)}
          type="emails"
        />
        <StatCard
          title="Conversions"
          value={stats?.conversions || 0}
          change={calculateChange(stats?.conversions || 0, stats?.previousPeriod.conversions || 0)}
          type="conversions"
        />
        <StatCard
          title="Conv. Rate"
          value={stats?.convRate || 0}
          change={calculateChange(stats?.convRate || 0, stats?.previousPeriod.convRate || 0)}
          type="rate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Growth Chart */}
        <div className="lg:col-span-2">
          <LeadGrowthChart data={stats?.leadsTrend || []} />
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
            {topOpportunities.length > 0 ? (
              topOpportunities.map((lead) => (
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
              ))
            ) : (
              <p className="text-gray-400 text-center py-4">No opportunities yet</p>
            )}
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
          {recentLeads.length > 0 ? (
            recentLeads.map((lead) => (
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
                  <span className="text-sm text-gray-500 capitalize">{lead.source.replace("_", " ")}</span>
                  <span className="text-sm text-gray-500">{lead.owner}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">No leads yet</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
