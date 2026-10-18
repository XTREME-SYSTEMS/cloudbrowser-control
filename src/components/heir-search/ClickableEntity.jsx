import { useState } from "react";
import EntitySearchDialog from "./EntitySearchDialog";

/**
 * Wraps any text (name, address) to make it clickable.
 * Clicking opens a deep search dialog with results for that entity.
 */
export default function ClickableEntity({ children, type = "name", className = "" }) {
  const [open, setOpen] = useState(false);
  if (!children || typeof children !== "string" || children.trim() === "" || children === "—") {
    return <span className={className}>{children}</span>;
  }
  return (
    <>
      <span
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`cursor-pointer text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors ${className}`}
        title={`Deep search for ${children}`}
      >
        {children}
      </span>
      <EntitySearchDialog open={open} onOpenChange={setOpen} query={children} type={type} />
    </>
  );
}