"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TopOpportunities } from "@/components/leads/TopOpportunities";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadModal } from "@/components/leads/LeadModal";
import { getTopOpportunities } from "@/lib/mockData";
import { Lead, LeadStage } from "@/types";
import { LayoutGrid, List, Plus, Archive, RefreshCw, BarChart2, PauseCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageChart } from "@/components/leads/StageChart";

type ViewMode = "table" | "kanban" | "chart";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeToLead, setComposeToLead] = useState<Lead | null>(null);
  const [composeType, setComposeType] = useState<"followup" | "onboarding" | "general">("followup");
  const [showArchived, setShowArchived] = useState(false);
  const [showOnHold, setShowOnHold] = useState(false);
  const [showConverted, setShowConverted] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

  // Stages that are hidden by default (archived stages)
  const archivedStages = ["not_interested", "no_response", "not_qualified"];

  // Filter leads for table/board view
  // - Hide archived stages unless showArchived is on
  // - Hide on_hold unless showOnHold is on
  // - Hide converted unless showConverted is on
  // Chart view gets all leads for complete stats
  const tableLeads = leads.filter(l => {
    // Show archived stages only when showArchived is on
    if (archivedStages.includes(l.stage) && !showArchived) return false;
    // Show on_hold only when showOnHold is on
    if (l.stage === "on_hold" && !showOnHold) return false;
    // Show converted only when showConverted is on
    if (l.stage === "converted" && !showConverted) return false;
    return true;
  });

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

      const data = await response.json();

      if (response.ok) {
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId ? { ...lead, stage: newStage } : lead
          )
        );
        fetchAllLeads(); // Refresh top opportunities
      } else {
        console.error("Failed to update stage:", data.error);
        alert(`Failed to update stage: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating stage:", error);
      alert("Failed to update stage. Please try again.");
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

  // Sync last_contacted from email history (for Zapier-sent emails, etc.)
  const handleSyncLastContacted = async (leadId: string, emailDate: string) => {
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_contacted: emailDate }),
      });

      // Update local state
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, last_contacted: emailDate } : lead
        )
      );
    } catch (error) {
      console.error("Error syncing last_contacted:", error);
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
    setComposeType("followup");
    setEmailSubject(`Following up${lead.company ? ` - ${lead.company}` : ""}`);
    setEmailBody(`Hi ${lead.name.split(" ")[0]},\n\nJust following up on this one and seeing if you needed any further information?\n\nLook forward to hearing from you.\n\nThanks,\n\nHeath`);
    setIsComposeOpen(true);
  };

  const handleOnboardingEmail = (lead: Lead) => {
    setComposeToLead(lead);
    setComposeType("onboarding");
    setEmailSubject(`Welcome to Seam Media${lead.company ? ` - ${lead.company}` : ""}`);
    setEmailBody(`Hi ${lead.name.split(" ")[0]},\n\nWelcome to Seam Media! We're thrilled to have you on board.\n\nI wanted to personally reach out and introduce myself. I'll be your main point of contact throughout our partnership.\n\nHere's what happens next:\n1. We'll schedule a kickoff call to discuss your goals\n2. Our team will begin the onboarding process\n3. You'll receive access to our client portal\n\nPlease let me know if you have any questions or if there's anything specific you'd like to discuss.\n\nThanks,\n\nHeath`);
    setIsComposeOpen(true);
  };

  const handleGeneralEmail = (lead: Lead) => {
    setComposeToLead(lead);
    setComposeType("general");
    setEmailSubject("");
    setEmailBody(`Hi ${lead.name.split(" ")[0]},\n\n\n\nThanks,\n\nHeath`);
    setIsComposeOpen(true);
  };

  const handleSendEmail = async () => {
    if (!composeToLead) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeToLead.email,
          subject: emailSubject,
          content: emailBody,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Determine the new stage based on email type (only for followup and onboarding)
        let newStage: LeadStage | null = null;
        if (composeType === "onboarding") {
          newStage = "onboarding_sent";
        } else if (composeType === "followup") {
          newStage = "contacted_2";
        }

        // Update in database
        const updateData: Record<string, unknown> = {
          last_contacted: new Date().toISOString()
        };
        if (newStage) {
          updateData.stage = newStage;
        }

        await fetch(`/api/leads/${composeToLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        // Update locally
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === composeToLead.id
              ? { ...lead, last_contacted: new Date().toISOString(), ...(newStage ? { stage: newStage } : {}) }
              : lead
          )
        );
        setIsComposeOpen(false);
        setComposeToLead(null);

        if (newStage) {
          const stageLabel = newStage === "onboarding_sent" ? "Onboarding Sent" : "Contacted 2";
          alert(`Email sent successfully! Stage updated to ${stageLabel}.`);
        } else {
          alert("Email sent successfully!");
        }
      } else {
        alert(`Failed to send email: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
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
            <button
              onClick={() => setViewMode("chart")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === "chart"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <BarChart2 className="w-4 h-4" />
              Chart
            </button>
          </div>

          {/* On Hold Filter Toggle */}
          <button
            onClick={() => setShowOnHold(!showOnHold)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              showOnHold
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <PauseCircle className="w-4 h-4" />
            {showOnHold ? "Showing On Hold" : "Show On Hold"}
          </button>

          {/* Converted Filter Toggle */}
          <button
            onClick={() => setShowConverted(!showConverted)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              showConverted
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            {showConverted ? "Showing Converted" : "Show Converted"}
          </button>

          {/* Archive Filter Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              showArchived
                ? "bg-red-50 text-red-700 border-red-200"
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
          {viewMode === "table" && (
            <LeadsTable
              leads={tableLeads}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
              onStageChange={handleStageChange}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
              onArchiveLead={showArchived ? handleUnarchiveLead : handleArchiveLead}
              onFollowUpEmail={handleFollowUpEmail}
              onOnboardingEmail={handleOnboardingEmail}
              showArchived={showArchived}
            />
          )}
          {viewMode === "kanban" && (
            <KanbanBoard
              leads={tableLeads}
              onUpdateLead={handleUpdateLead}
              onEditLead={handleEditLead}
            />
          )}
          {viewMode === "chart" && (
            <StageChart leads={allLeads} />
          )}
        </>
      )}

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLead}
        onEmail={handleGeneralEmail}
        onUpdateLastContacted={handleSyncLastContacted}
        lead={selectedLead}
      />

      {/* Email Modal */}
      {isComposeOpen && composeToLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {composeType === "onboarding" ? "Send Onboarding Email" : composeType === "followup" ? "Follow Up Email" : "Compose Email"}
              </h2>
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
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={10}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
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
                disabled={isSendingEmail}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
