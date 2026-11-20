"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  minChars?: number;
  listId?: string;
  "aria-label"?: string;
}

/**
 * Lightweight combobox for picking a previously-recorded merchant.
 * Unlike <datalist>, the popover only opens after the user has typed
 * `minChars` characters, and the list is filtered + capped to the
 * closest matches so the dropdown never dumps hundreds of rows at once.
 */
export function MerchantAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className = "input",
  required,
  minChars = 2,
  listId
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < minChars) return [] as string[];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const s of suggestions) {
      const l = s.toLowerCase();
      if (l === q) continue;
      if (l.startsWith(q)) starts.push(s);
      else if (l.includes(q)) contains.push(s);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [value, suggestions, minChars]);

  // Close on outside click / touch.
  useEffect(() => {
    function onDocDown(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, []);

  function pick(s: string) {
    onChange(s);
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matched.length === 0) {
      if (e.key === "ArrowDown" && matched.length > 0) {
        setOpen(true);
        setHighlight(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matched.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matched.length) % matched.length);
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(matched[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === "Tab" && highlight >= 0) {
      pick(matched[highlight]);
    }
  }

  const resolvedListId = listId ?? "merchant-ac-list";

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => {
          if (value.trim().length >= minChars) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matched.length > 0}
        aria-autocomplete="list"
        aria-controls={resolvedListId}
      />
      {open && matched.length > 0 && (
        <ul
          id={resolvedListId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-card-hover py-1"
        >
          {matched.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              // onMouseDown fires before blur so the input value is replaced before focus leaves.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight ? "bg-emerald-50 text-brand-navy" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
