export function TooltipProvider({ children }) {
  return children;
}
export function Tooltip({ children }) {
  return <span className="relative inline-flex group">{children}</span>;
}
export function TooltipTrigger({ children, ...props }) {
  return <span {...props}>{children}</span>;
}
export function TooltipContent({ children, className = "" }) {
  return (
    <span
      className={`absolute z-50 hidden -translate-y-2 whitespace-pre rounded-md border bg-white px-2 py-1 text-xs shadow group-hover:block ${className}`}
      style={{ top: "-2rem" }}
    >
      {children}
    </span>
  );
}
