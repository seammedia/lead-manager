"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TopOpportunities } from "@/components/leads/TopOpportunities";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadModal } from "@/components/leads/LeadModal";
import { mockLeads, getTopOpportunities } from "@/lib/mockData";
import { Lead } from "@/types";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const topOpportunities = getTopOpportunities(leads);

  const handleAddLead = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
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
    <AppLayout title="Leads" subtitle="Welcome back, Keanu">
      <TopOpportunities leads={topOpportunities} />
      <LeadsTable
        leads={leads}
        onAddLead={handleAddLead}
        onEditLead={handleEditLead}
      />
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLead}
        lead={selectedLead}
      />
    </AppLayout>
  );
}
