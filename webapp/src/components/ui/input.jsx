import React from "react";

export const Input = React.forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 ${className}`}
      {...props}
    />
  );
});
