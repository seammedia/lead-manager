"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lead, LeadStage, LeadSource } from "@/types";
import { LeadStageTag } from "./LeadStageTag";
import { getInitials, getAvatarColor, formatDate } from "@/lib/utils";
import {
  Search,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  Archive,
  Mail,
  Trash2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadsTableProps {
  leads: Lead[];
  onAddLead: () => void;
  onEditLead: (lead: Lead) => void;
  onStageChange: (leadId: string, newStage: LeadStage) => void;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
  onDeleteLead?: (leadId: string) => void;
  onArchiveLead?: (leadId: string) => void;
  onFollowUpEmail?: (lead: Lead) => void;
  onOnboardingEmail?: (lead: Lead) => void;
  showArchived?: boolean;
}

type SortField = "name" | "stage" | "owner" | "source" | "revenue" | "last_contacted" | "created_at";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 6;

const owners = ["Heath Maes"];

const sourceConfig: Record<LeadSource, { label: string; className: string }> = {
  website: { label: "Website", className: "bg-blue-100 text-blue-700" },
  linkedin: { label: "LinkedIn", className: "bg-sky-100 text-sky-700" },
  referral: { label: "Referral", className: "bg-purple-100 text-purple-700" },
  email: { label: "Email", className: "bg-green-100 text-green-700" },
  instagram: { label: "Instagram Messages", className: "bg-pink-100 text-pink-700" },
  meta_ads: { label: "Meta Ads", className: "bg-indigo-100 text-indigo-700" },
  google_ads: { label: "Google Ads", className: "bg-yellow-100 text-yellow-700" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700" },
};

// Editable Dropdown Component with Portal
function EditableDropdown<T extends string>({
  value,
  options,
  onChange,
  renderOption,
  renderValue,
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  renderOption: (option: T) => React.ReactNode;
  renderValue: (value: T) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  const dropdown = isOpen && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
      style={{ top: position.top, left: position.left, zIndex: 9999 }}
    >
      {options.map((option) => (
        <button
          key={option}
          onClick={(e) => {
            e.stopPropagation();
            onChange(option);
            setIsOpen(false);
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
        >
          {renderOption(option)}
          {option === value && <Check className="w-4 h-4 text-green-500" />}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
      >
        {renderValue(value)}
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {dropdown}
    </>
  );
}

// Actions Menu Component with Portal
function ActionsMenu({
  lead,
  onArchive,
  onFollowUp,
  onOnboarding,
  onDelete,
  isArchived,
}: {
  lead: Lead;
  onArchive?: () => void;
  onFollowUp?: () => void;
  onOnboarding?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  const menu = isOpen && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
      style={{ top: position.top, right: position.right, zIndex: 9999 }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onArchive?.();
          setIsOpen(false);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Archive className="w-4 h-4" />
        {isArchived ? "Unarchive" : "Archive"}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOnboarding?.();
          setIsOpen(false);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Send className="w-4 h-4" />
        Send Onboarding Email
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFollowUp?.();
          setIsOpen(false);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors text-gray-700"
      >
        <Mail className="w-4 h-4" />
        Follow Up Email
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete ${lead.name}?`)) {
            onDelete?.();
          }
          setIsOpen(false);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 transition-colors text-red-600"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 hover:bg-gray-100 rounded transition-colors"
      >
        <MoreHorizontal className="w-5 h-5 text-gray-400" />
      </button>
      {menu}
    </>
  );
}

export function LeadsTable({
  leads,
  onAddLead,
  onEditLead,
  onStageChange,
  onUpdateLead,
  onDeleteLead,
  onArchiveLead,
  onFollowUpEmail,
  onOnboardingEmail,
  showArchived = false,
}: LeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      // Filter by search query only (archived filtering is done at API level)
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "stage":
        comparison = a.stage.localeCompare(b.stage);
        break;
      case "owner":
        comparison = a.owner.localeCompare(b.owner);
        break;
      case "source":
        comparison = a.source.localeCompare(b.source);
        break;
      case "revenue":
        const revA = a.revenue || 0;
        const revB = b.revenue || 0;
        comparison = revA - revB;
        break;
      case "last_contacted":
        const dateA = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
        const dateB = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLeads = sortedLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <div className="w-3 h-3" />
        )}
      </div>
    </th>
  );

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
              <SortableHeader field="name">Lead Name</SortableHeader>
              <SortableHeader field="stage">Stage</SortableHeader>
              <SortableHeader field="owner">Owner</SortableHeader>
              <SortableHeader field="source">Source</SortableHeader>
              <SortableHeader field="revenue">Revenue</SortableHeader>
              <SortableHeader field="last_contacted">Last Contacted</SortableHeader>
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
                <td className="px-4 py-4">
                  <EditableDropdown
                    value={lead.owner}
                    options={owners}
                    onChange={(newOwner) => onUpdateLead?.(lead.id, { owner: newOwner })}
                    renderValue={(owner) => (
                      <span className="text-sm text-gray-600">{owner}</span>
                    )}
                    renderOption={(owner) => (
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full ${getAvatarColor(owner)} flex items-center justify-center text-white text-xs font-medium`}
                        >
                          {getInitials(owner)}
                        </div>
                        <span className="text-gray-700">{owner}</span>
                      </div>
                    )}
                  />
                </td>
                <td className="px-4 py-4">
                  <EditableDropdown
                    value={lead.source}
                    options={Object.keys(sourceConfig) as LeadSource[]}
                    onChange={(newSource) => onUpdateLead?.(lead.id, { source: newSource })}
                    renderValue={(source) => {
                      const config = sourceConfig[source];
                      return (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            config.className
                          )}
                        >
                          {config.label}
                        </span>
                      );
                    }}
                    renderOption={(source) => {
                      const config = sourceConfig[source];
                      return (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              config.className.split(" ")[0]
                            )}
                          />
                          <span className="text-gray-700">{config.label}</span>
                        </div>
                      );
                    }}
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {lead.revenue ? (
                    <span className="font-medium text-green-600">
                      ${lead.revenue.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {lead.last_contacted ? formatDate(lead.last_contacted) : "Never"}
                </td>
                <td className="px-4 py-4">
                  <ActionsMenu
                    lead={lead}
                    onArchive={() => onArchiveLead?.(lead.id)}
                    onOnboarding={() => onOnboardingEmail?.(lead)}
                    onFollowUp={() => onFollowUpEmail?.(lead)}
                    onDelete={() => onDeleteLead?.(lead.id)}
                    isArchived={showArchived}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedLeads.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <p>No leads found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sortedLeads.length)} of{" "}
            {sortedLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
