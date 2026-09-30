import React from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className = "", glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`glass-panel rounded-2xl p-8 relative overflow-hidden ${
          glow ? "shadow-2xl shadow-blue-500/10 animate-glow" : ""
        } ${className}`}
        {...props}
      >
        {glow && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/8 rounded-full blur-[80px] pointer-events-none -mr-40 -mt-40" />
        )}
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
export default GlassPanel;
