import React from "react";

const DialogContext = React.createContext();

export function Dialog({ children, open, onOpenChange }) {
  const [isOpen, setIsOpen] = React.useState(open || false);
  const set = (v) => {
    setIsOpen(v);
    onOpenChange?.(v);
  };
  return (
    <DialogContext.Provider value={{ open: isOpen, set }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children }) {
  const ctx = React.useContext(DialogContext);
  return React.cloneElement(children, {
    onClick: () => ctx.set(true),
  });
}

export function DialogContent({ children, className = "" }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => ctx.set(false)}>
      <div className={`bg-white p-4 rounded-xl max-h-[90vh] overflow-auto ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className = "" }) {
  return <div className={`mb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = "" }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}
