import React from "react";

export function Checkbox({ className = "", onCheckedChange, ...props }) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 ${className}`}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}
