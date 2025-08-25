export function Button({ children, className = "", variant = "default", ...props }) {
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-300 bg-white hover:bg-slate-50",
    ghost: "bg-transparent hover:bg-slate-100",
  };
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm shadow-sm transition ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
