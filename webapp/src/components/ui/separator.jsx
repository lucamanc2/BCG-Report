export function Separator({ className = "", ...props }) {
  return <div className={`h-px w-full bg-gray-200 ${className}`} {...props} />;
}
