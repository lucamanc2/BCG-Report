import React, { useState } from "react";

export function Tabs({ value, onValueChange, children, className = "" }) {
  const [internal, setInternal] = useState(value);
  const val = value !== undefined ? value : internal;
  const setVal = onValueChange || setInternal;
  return <div className={className} data-value={val}>{React.Children.map(children, child => {
    if (child.type === TabsList) {
      return React.cloneElement(child, { value: val, onValueChange: setVal });
    }
    if (child.type === TabsContent) {
      return child.props.value === val ? child : null;
    }
    return child;
  })}</div>;
}

export function TabsList({ children, value, onValueChange, className = "" }) {
  return <div className={className}>{React.Children.map(children, child => React.cloneElement(child, { active: child.props.value === value, onSelect: onValueChange }))}</div>;
}

export function TabsTrigger({ children, value, onSelect, active, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`${className} ${active ? "font-semibold" : "opacity-70"}`}
      onClick={() => onSelect && onSelect(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ children, className = "", ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
