import { cn } from "~/lib/utils";

export function CivicCrest({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn("h-9 w-9 shrink-0", className)}
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="9"
        fill="#132B4C"
        stroke="#D97706"
        strokeWidth="1.25"
      />
      <circle
        cx="20"
        cy="20"
        r="13.5"
        stroke="#F59E0B"
        strokeOpacity="0.42"
        strokeWidth="1"
      />
      <path
        d="M20 8.2L22.65 15.65L30.55 15.85L24.28 20.62L26.52 28.18L20 23.7L13.48 28.18L15.72 20.62L9.45 15.85L17.35 15.65L20 8.2Z"
        fill="#F59E0B"
        stroke="#FDE68A"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="2.2" fill="#0C1E35" />
    </svg>
  );
}

