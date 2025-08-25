import React from "react";

const TabsContext = React.createContext();

export function Tabs({ value: valueProp, onValueChange, children, className = "" }) {
  const [value, setValue] = React.useState(valueProp);
  const current = valueProp !== undefined ? valueProp : value;
  const set = (v) => {
    setValue(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, set }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return <div className={`flex ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "" }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.set(value)}
      className={`px-3 py-1 text-sm rounded-t-md border-b-2 ${active ? "border-slate-900" : "border-transparent"} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
