"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TopOpportunities } from "@/components/leads/TopOpportunities";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadModal } from "@/components/leads/LeadModal";
import { getTopOpportunities } from "@/lib/mockData";
import { Lead, LeadStage } from "@/types";
import { LayoutGrid, List, Plus, Archive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeToLead, setComposeToLead] = useState<Lead | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch leads from API
  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/leads?archived=${showArchived}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  // Fetch all leads (both archived and non-archived) for top opportunities
  const [allLeads, setAllLeads] = useState<Lead[]>([]);

  const fetchAllLeads = useCallback(async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch("/api/leads?archived=false"),
        fetch("/api/leads?archived=true")
      ]);

      if (activeRes.ok && archivedRes.ok) {
        const activeData = await activeRes.json();
        const archivedData = await archivedRes.json();
        setAllLeads([...(activeData.leads || []), ...(archivedData.leads || [])]);
      }
    } catch (error) {
      console.error("Error fetching all leads:", error);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchAllLeads();
  }, [fetchAllLeads]);

  const topOpportunities = getTopOpportunities(allLeads.filter(l => !l.archived));

  const handleAddLead = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (response.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId ? { ...lead, stage: newStage } : lead
          )
        );
        fetchAllLeads(); // Refresh top opportunities
      }
    } catch (error) {
      console.error("Error updating stage:", error);
    }
  };

  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId ? data.lead : lead
          )
        );
        fetchAllLeads(); // Refresh top opportunities
      }
    } catch (error) {
      console.error("Error updating lead:", error);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
        fetchAllLeads(); // Refresh top opportunities
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  };

  const handleArchiveLead = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      if (response.ok) {
        setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
        fetchAllLeads(); // Refresh top opportunities
      }
    } catch (error) {
      console.error("Error archiving lead:", error);
    }
  };

  const handleUnarchiveLead = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });

      if (response.ok) {
        setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
        fetchAllLeads(); // Refresh top opportunities
      }
    } catch (error) {
      console.error("Error unarchiving lead:", error);
    }
  };

  const handleFollowUpEmail = (lead: Lead) => {
    setComposeToLead(lead);
    setIsComposeOpen(true);
  };

  const handleSaveLead = async (leadData: Partial<Lead>) => {
    try {
      if (leadData.id) {
        // Edit existing lead
        const response = await fetch(`/api/leads/${leadData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadData),
        });

        if (response.ok) {
          const data = await response.json();
          setLeads((prev) =>
            prev.map((lead) =>
              lead.id === leadData.id ? data.lead : lead
            )
          );
        }
      } else {
        // Add new lead
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadData),
        });

        if (response.ok) {
          const data = await response.json();
          setLeads((prev) => [data.lead, ...prev]);
        }
      }
      fetchAllLeads(); // Refresh top opportunities
    } catch (error) {
      console.error("Error saving lead:", error);
    }
    setIsModalOpen(false);
  };

  return (
    <AppLayout title="Leads" subtitle="Welcome back, Heath">
      <TopOpportunities leads={topOpportunities} />

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <List className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Board
            </button>
          </div>

          {/* Archive Filter Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              showArchived
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "Showing Archived" : "Show Archived"}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => { fetchLeads(); fetchAllLeads(); }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {viewMode === "kanban" && (
          <button
            onClick={handleAddLead}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading leads...</p>
        </div>
      ) : (
        <>
          {/* Content based on view mode */}
          {viewMode === "table" ? (
            <LeadsTable
              leads={leads}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
              onStageChange={handleStageChange}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
              onArchiveLead={showArchived ? handleUnarchiveLead : handleArchiveLead}
              onFollowUpEmail={handleFollowUpEmail}
              showArchived={showArchived}
            />
          ) : (
            <KanbanBoard
              leads={leads}
              onUpdateLead={handleUpdateLead}
              onEditLead={handleEditLead}
            />
          )}
        </>
      )}

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLead}
        lead={selectedLead}
      />

      {/* Follow Up Email Modal */}
      {isComposeOpen && composeToLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Follow Up Email</h2>
              <button
                onClick={() => {
                  setIsComposeOpen(false);
                  setComposeToLead(null);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  type="email"
                  defaultValue={composeToLead.email}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-500">
                  {composeToLead.name} {composeToLead.company && `at ${composeToLead.company}`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  defaultValue={`Following up${composeToLead.company ? ` - ${composeToLead.company}` : ""}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={10}
                  defaultValue={`Hi ${composeToLead.name.split(" ")[0]},\n\nI wanted to follow up on our previous conversation.${composeToLead.company ? ` I'd love to schedule a time to discuss how we can help ${composeToLead.company}.` : ""}\n\nWould you be available for a quick call this week?\n\nBest regards,\nHeath Maes\nSeam Media`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsComposeOpen(false);
                  setComposeToLead(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Update last_contacted
                  handleUpdateLead(composeToLead.id, {
                    last_contacted: new Date().toISOString(),
                  });
                  setIsComposeOpen(false);
                  setComposeToLead(null);
                  alert("Email sent! (In production, this would send via Gmail API)");
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
