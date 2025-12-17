"use client";

import { useState, useEffect } from "react";
import { Lead, LeadStage, LeadSource } from "@/types";
import { X, Mail, Send, Loader2, MessageSquare } from "lucide-react";

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: Partial<Lead>) => void;
  onEmail?: (lead: Lead) => void;
  onUpdateLastContacted?: (leadId: string, date: string) => void;
  lead?: Lead | null;
}

interface EmailMessage {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  date: string;
  rawDate?: string;
  isFromMe?: boolean;
}

const stages: { value: LeadStage; label: string }[] = [
  { value: "contacted_1", label: "Contacted 1" },
  { value: "contacted_2", label: "Contacted 2" },
  { value: "called", label: "Called" },
  { value: "not_interested", label: "Not Interested" },
  { value: "no_response", label: "No Response" },
  { value: "not_qualified", label: "Not Qualified" },
  { value: "interested", label: "Interested" },
  { value: "onboarding_sent", label: "Onboarding Sent" },
  { value: "converted", label: "Converted" },
];

const sources: { value: LeadSource; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "referral", label: "Referral" },
  { value: "email", label: "Email" },
  { value: "instagram", label: "Instagram Messages" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "other", label: "Other" },
];

export function LeadModal({ isOpen, onClose, onSave, onEmail, onUpdateLastContacted, lead }: LeadModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    stage: "contacted_1" as LeadStage,
    source: "website" as LeadSource,
    owner: "Heath Maes",
    conversion_probability: 20,
    revenue: "" as string | number,
    next_action: "",
    notes: "",
  });

  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone || "",
        stage: lead.stage,
        source: lead.source,
        owner: lead.owner,
        conversion_probability: lead.conversion_probability,
        revenue: lead.revenue || "",
        next_action: lead.next_action || "",
        notes: lead.notes || "",
      });

      // Fetch emails for this contact
      fetchEmails(lead.email, lead);
    } else {
      setFormData({
        name: "",
        company: "",
        email: "",
        phone: "",
        stage: "contacted_1",
        source: "website",
        owner: "Heath Maes",
        conversion_probability: 20,
        revenue: "",
        next_action: "",
        notes: "",
      });
      setEmails([]);
      setEmailError(null);
    }
  }, [lead, isOpen]);

  const fetchEmails = async (contactEmail: string, currentLead: Lead) => {
    setLoadingEmails(true);
    setEmailError(null);
    try {
      // Search for emails from or to this contact (don't pass labelIds to search all mail)
      const query = encodeURIComponent(`{from:${contactEmail} to:${contactEmail}}`);
      const response = await fetch(`/api/gmail/emails?query=${query}&maxResults=20`);

      if (response.ok) {
        const data = await response.json();
        const fetchedEmails = data.emails || [];
        setEmails(fetchedEmails);

        // Auto-sync last_contacted if we found emails and the most recent is newer
        if (fetchedEmails.length > 0 && onUpdateLastContacted) {
          const mostRecentEmail = fetchedEmails[0]; // Emails are sorted by date desc
          if (mostRecentEmail.rawDate) {
            const emailDate = new Date(mostRecentEmail.rawDate);
            const currentLastContacted = currentLead.last_contacted
              ? new Date(currentLead.last_contacted)
              : null;

            // Update if no last_contacted or if email is more recent
            if (!currentLastContacted || emailDate > currentLastContacted) {
              onUpdateLastContacted(currentLead.id, mostRecentEmail.rawDate);
            }
          }
        }

        // If lead is in "contacted_1" and has responded, check and auto-advance to "interested"
        if (currentLead.stage === "contacted_1") {
          checkAndAdvanceIfResponded(currentLead.id);
        }
      } else if (response.status === 401) {
        setEmailError("Connect Gmail to see email history");
      } else {
        setEmailError("Unable to load emails");
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      setEmailError("Unable to load emails");
    } finally {
      setLoadingEmails(false);
    }
  };

  // Check if lead has responded and auto-advance to "interested"
  const checkAndAdvanceIfResponded = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/check-responses?leadId=${leadId}`);
      const data = await response.json();
      if (data.advanced > 0) {
        // Update the form stage to reflect the change
        setFormData(prev => ({ ...prev, stage: "interested" }));
        console.log(`Lead auto-advanced to Interested`);
      }
    } catch (error) {
      console.error("Error checking lead response:", error);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      revenue: formData.revenue ? Number(formData.revenue) : null,
      next_action: formData.next_action || null,
      id: lead?.id,
    });
    onClose();
  };

  const isEditMode = !!lead;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl w-full ${isEditMode ? 'max-w-5xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {lead ? lead.name : "Add New Lead"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-hidden flex ${isEditMode ? 'flex-row' : 'flex-col'}`}>
          {/* Left side - Lead Details Form */}
          <form onSubmit={handleSubmit} className={`${isEditMode ? 'w-1/2 border-r border-gray-200' : 'w-full'} overflow-y-auto p-4 space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value as LeadStage })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {stages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {sources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conversion Probability (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.conversion_probability}
                  onChange={(e) =>
                    setFormData({ ...formData, conversion_probability: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenue ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter revenue when converted"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Action
              </label>
              <input
                type="text"
                placeholder="e.g., Send SEO details, Schedule call"
                value={formData.next_action}
                onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Footer buttons inside form */}
            <div className="flex justify-between pt-4 border-t border-gray-100">
              <div>
                {lead && onEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      onEmail(lead);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Compose Email
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                >
                  {lead ? "Save Changes" : "Add Lead"}
                </button>
              </div>
            </div>
          </form>

          {/* Right side - Email History (only in edit mode) */}
          {isEditMode && (
            <div className="w-1/2 flex flex-col overflow-hidden bg-gray-50">
              <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Email History
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Communication with {formData.email}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loadingEmails ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : emailError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Mail className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">{emailError}</p>
                  </div>
                ) : emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Mail className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No emails found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Start a conversation by sending an email
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">
                            {email.from}
                          </span>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {email.date}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 truncate mb-1">
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {email.preview}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
