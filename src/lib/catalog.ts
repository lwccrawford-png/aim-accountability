// Configurable catalogs. IDs are stable; names, order and availability can
// change without touching stored goals.

export interface CatalogItem {
  id: string;
  name: string;
  order: number;
  available: boolean;
  lmtlssOnly?: boolean;
  hint?: string;
}

export const CATEGORIES: CatalogItem[] = [
  { id: "emotional_health", name: "Emotional Health", order: 1, available: true },
  { id: "knowledge_growth", name: "Knowledge & Growth", order: 2, available: true },
  { id: "financial_health", name: "Financial Health", order: 3, available: true },
  { id: "physical_health", name: "Physical Health", order: 4, available: true },
  { id: "relationships", name: "Relationships", order: 5, available: true },
  { id: "marriage", name: "Marriage", order: 6, available: true },
  { id: "fatherhood", name: "Fatherhood", order: 7, available: true },
  { id: "work", name: "Work & Calling", order: 8, available: true },
  { id: "memories", name: "Memories", order: 9, available: true },
  {
    id: "steps_of_faith",
    name: "Steps of Faith",
    order: 10,
    available: true,
    lmtlssOnly: true,
    hint: "Start a group, launch a business, take the step God's putting in front of you."
  }
];

// Tag labels. Picking "LMTLSS Room" opens the Room selector.
export const TAG_LABELS: CatalogItem[] = [
  {
    id: "lmtlss_room",
    name: "LMTLSS Room",
    order: 1,
    available: true,
    lmtlssOnly: true,
    hint: "Which part of manhood does this goal help you steward?"
  }
];

// Origins Rooms, verified against the v8 homepage (lmtlss-website/dist/index.html)
// on 2026-11-15. Ten rooms, Sonship first.
export const ROOMS: (CatalogItem & { must: string })[] = [
  { id: "sonship", name: "Sonship", order: 1, available: true, must: "To stand as men, we must begin as sons." },
  { id: "leadership", name: "Leadership", order: 2, available: true, must: "A man must accept the call to lead." },
  { id: "purpose", name: "Purpose", order: 3, available: true, must: "A man must work with purpose." },
  { id: "teacher", name: "Teacher", order: 4, available: true, must: "A man must carry the truth." },
  { id: "namer", name: "Namer", order: 5, available: true, must: "A man must speak life over others." },
  { id: "protector", name: "Protector", order: 6, available: true, must: "A man must cover what God gave him." },
  { id: "ruler", name: "Ruler", order: 7, available: true, must: "A man must steward what he's been given." },
  { id: "image_bearer", name: "Image-bearer", order: 8, available: true, must: "A man must reflect the King." },
  { id: "awareness", name: "Awareness", order: 9, available: true, must: "A man must stay awake to what matters." },
  { id: "cultivator", name: "Cultivator", order: 10, available: true, must: "A man must leave it better than he found it." }
];

export function visible<T extends CatalogItem>(items: T[], lmtlssMode: boolean): T[] {
  return items
    .filter((i) => i.available && (lmtlssMode || !i.lmtlssOnly))
    .sort((a, b) => a.order - b.order);
}

export const categoryName = (id?: string) => CATEGORIES.find((c) => c.id === id)?.name;
export const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;
