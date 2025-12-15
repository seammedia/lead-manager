"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TopOpportunities } from "@/components/leads/TopOpportunities";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadModal } from "@/components/leads/LeadModal";
import { mockLeads, getTopOpportunities } from "@/lib/mockData";
import { Lead, LeadStage } from "@/types";
import { LayoutGrid, List, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const topOpportunities = getTopOpportunities(leads);

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
        company: leadData.company!,
        email: leadData.email!,
        phone: leadData.phone || null,
        stage: leadData.stage || "new",
        source: leadData.source || "website",
        owner: leadData.owner!,
        conversion_probability: leadData.conversion_probability || 20,
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
        />
      ) : (
        <KanbanBoard
          leads={leads}
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
    </AppLayout>
  );
}
