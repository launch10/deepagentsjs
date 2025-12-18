import { Button } from "@components/ui/button";
import { Calendar } from "@components/ui/calendar";
import { Input } from "@components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { CalendarIcon } from "lucide-react";
import React, { useState, useEffect } from "react";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false;
  }
  return !isNaN(date.getTime());
}

export default function InputDatePicker({
  onChange,
  value,
  ...props
}: React.ComponentProps<"input">) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(value ? new Date(value as string) : undefined);
  const [month, setMonth] = useState<Date | undefined>(date);
  const [inputValue, setInputValue] = useState(formatDate(date));

  // Sync with external value changes
  useEffect(() => {
    if (value) {
      const newDate = new Date(value as string);
      if (isValidDate(newDate)) {
        setDate(newDate);
        setInputValue(formatDate(newDate));
      }
    } else {
      // Clear the date when value is undefined/null
      setDate(undefined);
      setInputValue("");
    }
  }, [value]);

  return (
    <div className="relative">
      <Input
        {...props}
        value={inputValue}
        onChange={(e) => {
          const newDate = new Date(e.target.value);
          setInputValue(e.target.value);
          if (isValidDate(newDate)) {
            setDate(newDate);
            setMonth(newDate);
            // Call onChange with the Date object
            onChange?.(newDate as any);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-picker"
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                setDate(selectedDate);
                setInputValue(formatDate(selectedDate));
                setOpen(false);
                // Call onChange with the Date object
                onChange?.(selectedDate as any);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
