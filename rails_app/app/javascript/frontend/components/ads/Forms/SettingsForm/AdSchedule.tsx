import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FieldGroup } from "@components/ui/field";
import { cn } from "@lib/utils";

type DayOfWeek = "Mon" | "Tues" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | "Always On";

const DAYS: DayOfWeek[] = ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun", "Always On"];

const TIMEZONES = [
  { value: "EST", label: "Eastern Standard Time - EST (GMT-5)" },
  { value: "CST", label: "Central Standard Time - CST (GMT-6)" },
  { value: "MST", label: "Mountain Standard Time - MST (GMT-7)" },
  { value: "PST", label: "Pacific Standard Time - PST (GMT-8)" },
];

export default function AdSchedule() {
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(
    new Set(["Mon", "Tues", "Wed", "Thu", "Fri"])
  );
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [timezone, setTimezone] = useState("EST");
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);

  const toggleDay = (day: DayOfWeek) => {
    const newSelected = new Set(selectedDays);
    if (day === "Always On") {
      if (newSelected.has("Always On")) {
        newSelected.delete("Always On");
      } else {
        newSelected.clear();
        newSelected.add("Always On");
      }
    } else {
      newSelected.delete("Always On");
      if (newSelected.has(day)) {
        newSelected.delete(day);
      } else {
        newSelected.add(day);
      }
    }
    setSelectedDays(newSelected);
  };

  const selectedTimezoneLabel = TIMEZONES.find((tz) => tz.value === timezone)?.label || "";

  return (
    <FieldGroup className="gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold leading-[18px] text-base-500">
          Ad Schedule
        </label>
        <div className="flex gap-2">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "h-10 px-[18px] py-3 rounded-lg text-sm leading-[18px] border bg-white transition-colors",
                selectedDays.has(day)
                  ? "border-base-600 text-base-500"
                  : "border-neutral-300 text-base-500"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex flex-col gap-2 w-[212px]">
          <label className="text-xs font-semibold leading-4 text-base-400">
            Start Time
          </label>
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-xs leading-4 text-base-500 outline-none focus:border-base-600"
          />
        </div>
        <div className="flex flex-col gap-2 w-[212px]">
          <label className="text-xs font-semibold leading-4 text-base-400">
            End Time
          </label>
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-xs leading-4 text-base-500 outline-none focus:border-base-600"
          />
        </div>
        <div className="flex flex-col gap-2 w-[313px]">
          <label className="text-xs font-semibold leading-4 text-base-400">
            Time Zone
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTimezoneOpen(!isTimezoneOpen)}
              className="h-10 w-full flex items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white pl-4 pr-3 py-3 text-xs leading-4 text-base-600 outline-none focus:border-base-600"
            >
              <span className="truncate">{selectedTimezoneLabel}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", isTimezoneOpen && "rotate-180")} />
            </button>
            {isTimezoneOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg z-10">
                {TIMEZONES.map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => {
                      setTimezone(tz.value);
                      setIsTimezoneOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-xs hover:bg-neutral-100 first:rounded-t-lg last:rounded-b-lg",
                      timezone === tz.value ? "text-base-600 bg-neutral-50" : "text-base-500"
                    )}
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </FieldGroup>
  );
}
