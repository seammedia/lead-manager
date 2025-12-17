"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { TimePeriod } from "@/types";

interface DateRangePickerProps {
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod, startDate?: Date, endDate?: Date) => void;
  customStart?: Date;
  customEnd?: Date;
}

const presets = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
] as const;

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DateRangePicker({ period, onPeriodChange, customStart, customEnd }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState<Date | null>(customStart || null);
  const [tempEnd, setTempEnd] = useState<Date | null>(customEnd || null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  };

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
  }, [isOpen]);

  const getDisplayText = () => {
    if (period === "custom" && customStart && customEnd) {
      return `${shortMonths[customStart.getMonth()]} ${customStart.getDate()} - ${shortMonths[customEnd.getMonth()]} ${customEnd.getDate()}, ${customEnd.getFullYear()}`;
    }
    const preset = presets.find(p => p.value === period);
    return preset?.label || "Select period";
  };

  const handlePresetClick = (value: string) => {
    onPeriodChange(value as TimePeriod);
    setIsOpen(false);
  };

  const handleDateClick = (date: Date) => {
    if (selectingStart) {
      setTempStart(date);
      setTempEnd(null);
      setSelectingStart(false);
    } else {
      if (tempStart && date < tempStart) {
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
      setSelectingStart(true);
    }
  };

  const handleApply = () => {
    if (tempStart && tempEnd) {
      onPeriodChange("custom", tempStart, tempEnd);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setTempStart(customStart || null);
    setTempEnd(customEnd || null);
    setIsOpen(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateInRange = (date: Date) => {
    if (!tempStart || !tempEnd) return false;
    return date >= tempStart && date <= tempEnd;
  };

  const isDateSelected = (date: Date) => {
    if (tempStart && date.toDateString() === tempStart.toDateString()) return true;
    if (tempEnd && date.toDateString() === tempEnd.toDateString()) return true;
    return false;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewMonth);
    const firstDay = getFirstDayOfMonth(viewMonth);
    const days = [];

    // Empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = isDateSelected(date);
      const isInRange = isDateInRange(date);

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={`w-8 h-8 text-sm rounded-full transition-colors ${
            isSelected
              ? "bg-blue-500 text-white"
              : isInRange
              ? "bg-blue-100 text-blue-700"
              : isToday
              ? "bg-gray-100 text-gray-900 font-semibold"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const dropdown = isOpen && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 flex"
      style={{ top: position.top, right: position.right, zIndex: 9999 }}
    >
      {/* Presets */}
      <div className="w-48 border-r border-gray-200 py-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              period === preset.value
                ? "bg-green-50 text-green-700 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <div className="border-t border-gray-200 my-2" />
        <button
          onClick={() => {
            setSelectingStart(true);
            setTempStart(null);
            setTempEnd(null);
          }}
          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
            period === "custom"
              ? "bg-green-50 text-green-700 font-medium"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Custom range
        </button>
      </div>

      {/* Calendar */}
      <div className="p-4 w-72">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {months[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </span>
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={i} className="w-8 h-8 flex items-center justify-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {renderCalendar()}
        </div>

        {/* Selected range display */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex gap-2 text-sm">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start date</label>
              <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-gray-700">
                {tempStart ? `${tempStart.getMonth() + 1}/${tempStart.getDate()}/${tempStart.getFullYear()}` : "Select"}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End date</label>
              <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-gray-700">
                {tempEnd ? `${tempEnd.getMonth() + 1}/${tempEnd.getDate()}/${tempEnd.getFullYear()}` : "Select"}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!tempStart || !tempEnd}
            className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        {getDisplayText()}
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      {dropdown}
    </>
  );
}
