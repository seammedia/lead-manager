"use client";

import { useState, useEffect } from "react";
import { DollarSign, Target, TrendingUp, Infinity } from "lucide-react";

interface CostMetricsProps {
  totalLeads: number;
  conversions: number;
  avgDealSize: number;
  avgLifetimeMonths: number;
}

export function CostMetrics({ totalLeads, conversions, avgDealSize, avgLifetimeMonths }: CostMetricsProps) {
  const [costPerLead, setCostPerLead] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const savedCPL = localStorage.getItem("costPerLead");
    if (savedCPL) {
      setCostPerLead(savedCPL);
    }
  }, []);

  const handleCPLChange = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    setCostPerLead(numericValue);
  };

  const handleCPLBlur = () => {
    setIsEditing(false);
    if (costPerLead) {
      localStorage.setItem("costPerLead", costPerLead);
    }
  };

  const calculateCPA = (): number | null => {
    const cpl = parseFloat(costPerLead);
    if (!cpl || cpl <= 0 || totalLeads === 0 || conversions === 0) {
      return null;
    }
    const totalAdSpend = cpl * totalLeads;
    return totalAdSpend / conversions;
  };

  const formatCPA = (): string => {
    const cpa = calculateCPA();
    if (cpa === null) {
      return "-";
    }
    return `$${cpa.toFixed(2)}`;
  };

  const calculateROAS = (): number | null => {
    const cpa = calculateCPA();
    if (cpa === null || cpa <= 0 || avgDealSize <= 0) {
      return null;
    }
    return avgDealSize / cpa;
  };

  const formatROAS = (): string => {
    const roas = calculateROAS();
    if (roas === null) {
      return "-";
    }
    return `${roas.toFixed(1)}X`;
  };

  const calculateLTVROAS = (): string => {
    const roas = calculateROAS();
    if (roas === null || avgLifetimeMonths <= 0) {
      return "-";
    }
    // LTV ROAS = ROAS × average lifetime months (minimum 1 month)
    const lifetimeMultiplier = Math.max(avgLifetimeMonths, 1);
    const ltvRoas = roas * lifetimeMultiplier;
    return `${ltvRoas.toFixed(1)}X`;
  };

  const formatLifetimeMonths = (): string => {
    if (avgLifetimeMonths <= 0) {
      return "No data";
    }
    const months = Math.max(avgLifetimeMonths, 1);
    return `${months.toFixed(1)} month${months !== 1 ? 's' : ''} avg`;
  };

  const formatCPL = (): string => {
    const cpl = parseFloat(costPerLead);
    if (!costPerLead || isNaN(cpl)) {
      return "-";
    }
    return `$${cpl.toFixed(2)}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Cost Per Lead - Editable */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">Cost Per Lead</p>
            {isEditing ? (
              <div className="flex items-center">
                <span className="text-2xl font-bold text-gray-900 mr-1">$</span>
                <input
                  type="text"
                  value={costPerLead}
                  onChange={(e) => handleCPLChange(e.target.value)}
                  onBlur={handleCPLBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleCPLBlur()}
                  autoFocus
                  className="text-2xl font-bold text-gray-900 w-24 border-b-2 border-green-500 outline-none bg-transparent"
                  placeholder="0.00"
                />
              </div>
            ) : (
              <p
                onClick={() => setIsEditing(true)}
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-green-600 transition-colors"
                title="Click to edit"
              >
                {formatCPL()}
              </p>
            )}
          </div>
          <div className="p-2 rounded-lg text-green-500 bg-green-50">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Click to update manually
        </p>
      </div>

      {/* Cost Per Acquisition - Auto-calculated */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Cost Per Acquisition</p>
            <p className="text-2xl font-bold text-gray-900">{formatCPA()}</p>
          </div>
          <div className="p-2 rounded-lg text-purple-500 bg-purple-50">
            <Target className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Auto-calculated from CPL & conversions
        </p>
      </div>

      {/* ROAS - Auto-calculated */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">ROAS</p>
            <p className="text-2xl font-bold text-gray-900">{formatROAS()}</p>
          </div>
          <div className="p-2 rounded-lg text-blue-500 bg-blue-50">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Avg Deal Size / Cost Per Acquisition
        </p>
      </div>

      {/* Lifetime Value ROAS - Calculated */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Lifetime Value ROAS</p>
            <p className="text-2xl font-bold text-gray-900">{calculateLTVROAS()}</p>
          </div>
          <div className="p-2 rounded-lg text-amber-500 bg-amber-50">
            <Infinity className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          ROAS × {formatLifetimeMonths()}
        </p>
      </div>
    </div>
  );
}
