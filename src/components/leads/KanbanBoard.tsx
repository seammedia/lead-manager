"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead, LeadStage } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";
import { GripVertical, Building2, Mail, Phone } from "lucide-react";

interface KanbanBoardProps {
  leads: Lead[];
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
  onEditLead: (lead: Lead) => void;
}

const stages: { id: LeadStage; label: string; color: string }[] = [
  { id: "contacted_1", label: "Contacted 1", color: "bg-yellow-500" },
  { id: "contacted_2", label: "Contacted 2", color: "bg-pink-500" },
  { id: "called", label: "Called", color: "bg-purple-500" },
  { id: "not_interested", label: "Not Interested", color: "bg-red-500" },
  { id: "no_response", label: "No Response", color: "bg-gray-500" },
  { id: "not_qualified", label: "Not Qualified", color: "bg-slate-500" },
  { id: "on_hold", label: "On Hold", color: "bg-amber-500" },
  { id: "interested", label: "Interested", color: "bg-orange-500" },
  { id: "onboarding_sent", label: "Onboarding Sent", color: "bg-teal-500" },
  { id: "converted", label: "Converted", color: "bg-emerald-500" },
];

function LeadCard({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-200 p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-0.5 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-8 h-8 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-medium text-xs`}
            >
              {getInitials(lead.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{lead.name}</p>
              <div className="flex items-center gap-1 text-gray-500">
                <Building2 className="w-3 h-3" />
                <span className="text-xs truncate">{lead.company}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{lead.owner}</span>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
              {lead.conversion_probability}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCardOverlay({ lead }: { lead: Lead }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <div className="mt-1 p-0.5">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-8 h-8 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-medium text-xs`}
            >
              {getInitials(lead.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{lead.name}</p>
              <div className="flex items-center gap-1 text-gray-500">
                <Building2 className="w-3 h-3" />
                <span className="text-xs truncate">{lead.company}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{lead.owner}</span>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
              {lead.conversion_probability}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
  onEditLead,
}: {
  stage: { id: LeadStage; label: string; color: string };
  leads: Lead[];
  onEditLead: (lead: Lead) => void;
}) {
  return (
    <div className="flex-shrink-0 w-[280px] bg-gray-50 rounded-lg">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${stage.color}`} />
          <span className="font-medium text-gray-900 text-sm">{stage.label}</span>
          <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
      </div>
      <div className="p-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onEdit={() => onEditLead(lead)} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ leads, onUpdateLead, onEditLead }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column
    const targetStage = stages.find((s) => s.id === overId);
    if (targetStage) {
      const activeLead = leads.find((l) => l.id === activeLeadId);
      if (activeLead && activeLead.stage !== targetStage.id) {
        onUpdateLead(activeLeadId, { stage: targetStage.id });
      }
      return;
    }

    // Check if dropped over another lead
    const overLead = leads.find((l) => l.id === overId);
    if (overLead) {
      const activeLead = leads.find((l) => l.id === activeLeadId);
      if (activeLead && activeLead.stage !== overLead.stage) {
        onUpdateLead(activeLeadId, { stage: overLead.stage });
      }
    }
  };

  const getLeadsByStage = (stageId: LeadStage) =>
    leads.filter((lead) => lead.stage === stageId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={getLeadsByStage(stage.id)}
            onEditLead={onEditLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
