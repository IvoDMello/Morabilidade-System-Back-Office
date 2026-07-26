import { CONTACT_CATEGORY_LABELS, CONTACT_CATEGORY_SOLID } from "@/constants/contact-categories";
import type { ContactCategory } from "@/constants/contact-categories";

/** Categoria no redesign: ponto colorido + texto, sem pill — só o status
 * carrega chip, para o olho não competir entre dois badges por linha. */
export function CategoryBadge({ category }: { category: ContactCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-mid">
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: CONTACT_CATEGORY_SOLID[category] }}
      />
      {CONTACT_CATEGORY_LABELS[category]}
    </span>
  );
}
