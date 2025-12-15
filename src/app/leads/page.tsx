"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TopOpportunities } from "@/components/leads/TopOpportunities";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadModal } from "@/components/leads/LeadModal";
import { mockLeads, getTopOpportunities } from "@/lib/mockData";
import { Lead, LeadStage } from "@/types";
import { LayoutGrid, List, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

const LEADS_STORAGE_KEY = "seam-media-leads";

// Load leads from localStorage or use mock data
function loadLeads(): Lead[] {
  if (typeof window === "undefined") return mockLeads;
  const stored = localStorage.getItem(LEADS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return mockLeads;
    }
  }
  return mockLeads;
}

// Save leads to localStorage
function saveLeads(leads: Lead[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeToLead, setComposeToLead] = useState<Lead | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Load leads from localStorage on mount
  useEffect(() => {
    const storedLeads = loadLeads();
    setLeads(storedLeads);
    setIsLoaded(true);
  }, []);

  // Save leads to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      saveLeads(leads);
    }
  }, [leads, isLoaded]);

  const topOpportunities = getTopOpportunities(leads.filter(l => !l.archived));

  const handleAddLead = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, stage: newStage, updated_at: new Date().toISOString() }
          : lead
      )
    );
  };

  const handleUpdateLead = (leadId: string, updates: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, ...updates, updated_at: new Date().toISOString() }
          : lead
      )
    );
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
  };

  const handleArchiveLead = (leadId: string) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, archived: true, updated_at: new Date().toISOString() }
          : lead
      )
    );
  };

  const handleUnarchiveLead = (leadId: string) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, archived: false, updated_at: new Date().toISOString() }
          : lead
      )
    );
  };

  const handleFollowUpEmail = (lead: Lead) => {
    setComposeToLead(lead);
    setIsComposeOpen(true);
  };

  const handleSaveLead = (leadData: Partial<Lead>) => {
    if (leadData.id) {
      // Edit existing lead
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadData.id
            ? { ...lead, ...leadData, updated_at: new Date().toISOString() }
            : lead
        )
      );
    } else {
      // Add new lead
      const newLead: Lead = {
        id: `${Date.now()}`,
        name: leadData.name!,
        company: leadData.company || "",
        email: leadData.email!,
        phone: leadData.phone || null,
        stage: leadData.stage || "new",
        source: leadData.source || "website",
        owner: leadData.owner || "Heath Maes",
        conversion_probability: leadData.conversion_probability || 20,
        revenue: leadData.revenue || null,
        notes: leadData.notes || null,
        last_contacted: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLeads((prev) => [newLead, ...prev]);
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
          leads={leads.filter(l => showArchived ? l.archived : !l.archived)}
          onUpdateLead={handleUpdateLead}
          onEditLead={handleEditLead}
        />
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
                  {composeToLead.name} at {composeToLead.company}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  defaultValue={`Following up - ${composeToLead.company}`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={10}
                  defaultValue={`Hi ${composeToLead.name.split(" ")[0]},\n\nI wanted to follow up on our previous conversation. I'd love to schedule a time to discuss how we can help ${composeToLead.company}.\n\nWould you be available for a quick call this week?\n\nBest regards,\nHeath Maes\nSeam Media`}
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
