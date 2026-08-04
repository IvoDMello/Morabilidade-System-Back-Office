export const TAG_COLORS = [
  { value: "slate", label: "Cinza" },
  { value: "blue", label: "Azul" },
  { value: "emerald", label: "Verde" },
  { value: "amber", label: "Âmbar" },
  { value: "pink", label: "Rosa" },
  { value: "violet", label: "Violeta" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["value"];

export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  slate: "bg-veil/6 text-ink-mid",
  blue: "bg-[rgba(90,162,247,0.14)] text-sky",
  emerald: "bg-[rgba(84,201,138,0.14)] text-jade-soft",
  amber: "bg-[rgba(231,221,166,0.14)] text-gold",
  pink: "bg-[rgba(212,127,168,0.14)] text-blush",
  violet: "bg-[rgba(139,127,212,0.14)] text-lilac",
};
