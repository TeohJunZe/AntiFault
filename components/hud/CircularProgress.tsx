import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number; // width and height in pixels
  strokeWidth?: number;
  color?: string; // Tailwind text color class, e.g., "text-cyan-400"
  trackColor?: string; // Tailwind text color class, e.g., "text-cyan-950/50"
  showLabel?: boolean;
  label?: string; // Top or bottom label
  className?: string; // Additional classes for the container
}

export default function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = "text-cyan-400",
  trackColor = "text-cyan-950/50",
  showLabel = true,
  label,
  className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)} style={{ width: size, height: size }}>
      
      {/* SVG Container */}
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background Track Circle */}
        <circle
          className={trackColor}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        
        {/* Progress Circle with Glow */}
        <circle
          className={cn(color, "transition-all duration-700 ease-in-out drop-shadow-[0_0_8px_currentColor]")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        
        {/* Inner dotted decorative ring for Stark aesthetic */}
        <circle
          className={trackColor}
          strokeWidth={strokeWidth / 4}
          strokeDasharray="4 4"
          stroke="currentColor"
          fill="transparent"
          r={radius - strokeWidth - 4}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>

      {/* Center Value Text */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={cn("text-xl font-bold font-mono", color, "drop-shadow-[0_0_5px_currentColor]")}>
            {Math.round(value)}%
          </span>
          {label && (
            <span className={cn("text-[10px] tracking-widest mt-1", color, "opacity-70 uppercase")}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
