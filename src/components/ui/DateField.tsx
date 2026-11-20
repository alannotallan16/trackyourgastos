"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  placeholder?: string;
}

/**
 * Date input that shows a visible placeholder when empty on iOS Safari.
 * Native `<input type="date">` renders as a blank box on iOS when unset,
 * which hides the "pick a date" affordance. This overlays a label-looking
 * string over the empty state and lets taps fall through to the input.
 */
export const DateField = forwardRef<HTMLInputElement, Props>(function DateField(
  { className = "input", placeholder = "Select date", value, ...rest },
  ref
) {
  const hasValue =
    typeof value === "string"
      ? value.length > 0
      : typeof value === "number"
        ? true
        : Array.isArray(value)
          ? value.length > 0
          : value != null;
  return (
    <span className="relative block">
      <input ref={ref} type="date" className={className} value={value as string | undefined} {...rest} />
      {!hasValue && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-400"
        >
          {placeholder}
        </span>
      )}
    </span>
  );
});
