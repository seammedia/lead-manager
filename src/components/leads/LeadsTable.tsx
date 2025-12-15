"use client";

import { useState } from "react";
import { Lead, LeadStage } from "@/types";
import { LeadStageTag } from "./LeadStageTag";
import { getInitials, getAvatarColor, formatDate } from "@/lib/utils";
import { Search, Plus, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

interface LeadsTableProps {
  leads: Lead[];
  onAddLead: () => void;
  onEditLead: (lead: Lead) => void;
  onStageChange: (leadId: string, newStage: LeadStage) => void;
}

const ITEMS_PER_PAGE = 6;

export function LeadsTable({ leads, onAddLead, onEditLead, onStageChange }: LeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">All Leads</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={onAddLead}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Contacted
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedLeads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onEditLead(lead)}
              >
                <td className="px-4 py-4">
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
                </td>
                <td className="px-4 py-4">
                  <LeadStageTag
                    stage={lead.stage}
                    editable
                    onStageChange={(newStage) => onStageChange(lead.id, newStage)}
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{lead.owner}</td>
                <td className="px-4 py-4 text-sm text-gray-600 capitalize">{lead.source}</td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {lead.last_contacted ? formatDate(lead.last_contacted) : "Never"}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5 text-gray-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-green-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}
