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
  blue: "bg-[rgba(91,155,213,0.14)] text-sky",
  emerald: "bg-[rgba(126,196,145,0.14)] text-jade-soft",
  amber: "bg-[rgba(216,203,106,0.14)] text-gold",
  pink: "bg-[rgba(212,127,168,0.14)] text-blush",
  violet: "bg-[rgba(139,127,212,0.14)] text-lilac",
};
