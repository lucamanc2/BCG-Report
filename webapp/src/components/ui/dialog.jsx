import React from "react";

export function Dialog({ open, onOpenChange, children }) {
  const items = React.Children.toArray(children);
  const trigger = items.find((c) => c.type === DialogTrigger);
  const content = items.find((c) => c.type === DialogContent);
  return (
    <>
      {trigger && React.cloneElement(trigger, { onClick: () => onOpenChange?.(true) })}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange?.(false)}>
          {content && React.cloneElement(content, { onClose: () => onOpenChange?.(false) })}
        </div>
      )}
    </>
  );
}

export function DialogTrigger({ children, ...props }) {
  return React.cloneElement(children, props);
}

export function DialogContent({ children, className = "", onClose, ...props }) {
  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-lg max-h-[90vh] overflow-auto ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className = "" }) {
  return <div className={`mb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = "" }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}
