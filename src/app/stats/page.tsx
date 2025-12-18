"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/stats/StatCard";
import { LeadGrowthChart } from "@/components/stats/LeadGrowthChart";
import { SourcePieChart } from "@/components/stats/SourcePieChart";
import { RevenueSourceChart } from "@/components/stats/RevenueSourceChart";
import { DateRangePicker } from "@/components/stats/DateRangePicker";
import { TimePeriod } from "@/types";

interface StatsApiResponse {
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
  leadsSourceBreakdown: { source: string; count: number; color: string }[];
  conversionsSourceBreakdown: { source: string; count: number; color: string }[];
  revenue: {
    total: number;
    currentPeriod: number;
    previousPeriod: number;
    avgDealSize: number;
    bySource: { source: string; amount: number; color: string }[];
  };
}

export default function StatsPage() {
  const [period, setPeriod] = useState<TimePeriod>("30");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [stats, setStats] = useState<StatsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        let url = `/api/stats?period=${period}`;
        if (period === "custom" && customStart && customEnd) {
          url += `&start=${customStart.toISOString()}&end=${customEnd.toISOString()}`;
        }
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [period, customStart, customEnd]);

  const handlePeriodChange = (newPeriod: TimePeriod, startDate?: Date, endDate?: Date) => {
    setPeriod(newPeriod);
    if (newPeriod === "custom" && startDate && endDate) {
      setCustomStart(startDate);
      setCustomEnd(endDate);
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  if (loading || !stats) {
    return (
      <AppLayout title="Stats" subtitle="Welcome back, Heath">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-400">Loading stats...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Stats" subtitle="Welcome back, Heath">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Performance Overview</h2>
        <DateRangePicker
          period={period}
          onPeriodChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>

      {/* Main Stats Cards */}
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
          title="Conv. Rate"
          value={stats.convRate}
          change={calculateChange(stats.convRate, stats.previousPeriod.convRate)}
          type="rate"
        />
      </div>

      {/* Lead Growth Trend and Source Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <LeadGrowthChart data={stats.leadsTrend} />
        </div>
        <div className="space-y-6">
          <SourcePieChart data={stats.leadsSourceBreakdown} title="Leads by Source" />
          <SourcePieChart data={stats.conversionsSourceBreakdown} title="Conversions by Source" />
        </div>
      </div>

      {/* Revenue Section */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={stats.revenue.total}
          change={calculateChange(stats.revenue.currentPeriod, stats.revenue.previousPeriod)}
          type="revenue"
          prefix="$"
        />
        <StatCard
          title="Period Revenue"
          value={stats.revenue.currentPeriod}
          change={calculateChange(stats.revenue.currentPeriod, stats.revenue.previousPeriod)}
          type="revenue"
          prefix="$"
        />
        <StatCard
          title="Avg. Deal Size"
          value={stats.revenue.avgDealSize}
          type="revenue"
          prefix="$"
        />
      </div>

      {/* Revenue by Source Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueSourceChart data={stats.revenue.bySource} title="Revenue by Source" />
      </div>
    </AppLayout>
  );
}
