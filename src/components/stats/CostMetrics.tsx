"use client";

import { useState, useEffect } from "react";
import { DollarSign, Target, TrendingUp, Infinity } from "lucide-react";

interface CostMetricsProps {
  periodLeads: number;
  periodConversionCount: number;
  periodConversionRevenue: number;
  periodLtvRevenue: number;
}

export function CostMetrics({
  periodLeads,
  periodConversionCount,
  periodConversionRevenue,
  periodLtvRevenue,
}: CostMetricsProps) {
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

  const getAdSpend = (): number | null => {
    const cpl = parseFloat(costPerLead);
    if (!cpl || cpl <= 0 || periodLeads === 0) return null;
    return cpl * periodLeads;
  };

  const formatCPA = (): string => {
    const adSpend = getAdSpend();
    if (adSpend === null || periodConversionCount === 0) return "-";
    return `$${(adSpend / periodConversionCount).toFixed(2)}`;
  };

  const formatROAS = (): string => {
    const adSpend = getAdSpend();
    if (adSpend === null || adSpend <= 0 || periodConversionRevenue <= 0) return "-";
    const roas = periodConversionRevenue / adSpend;
    return `${roas.toFixed(1)}X`;
  };

  const formatLTVROAS = (): string => {
    const adSpend = getAdSpend();
    if (adSpend === null || adSpend <= 0 || periodLtvRevenue <= 0) return "-";
    const ltvRoas = periodLtvRevenue / adSpend;
    return `${ltvRoas.toFixed(1)}X`;
  };

  const formatCPL = (): string => {
    const cpl = parseFloat(costPerLead);
    if (!costPerLead || isNaN(cpl)) return "-";
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

      {/* Cost Per Acquisition */}
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
          Ad spend / {periodConversionCount} conversion{periodConversionCount !== 1 ? "s" : ""} in period
        </p>
      </div>

      {/* ROAS */}
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
          ${periodConversionRevenue.toLocaleString()} revenue / ad spend
        </p>
      </div>

      {/* Lifetime Value ROAS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Lifetime Value ROAS</p>
            <p className="text-2xl font-bold text-gray-900">{formatLTVROAS()}</p>
          </div>
          <div className="p-2 rounded-lg text-amber-500 bg-amber-50">
            <Infinity className="w-5 h-5" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          ${Math.round(periodLtvRevenue).toLocaleString()} lifetime revenue / ad spend
        </p>
      </div>
    </div>
  );
}
