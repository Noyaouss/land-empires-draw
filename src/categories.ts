// Categories and canvas sizes. The real list is categories.json in the art repo; this starter copy is used until it loads.
export type Size = { name: string; w: number; h: number };
export type Category = { id: string; name: string; sizes: Size[] };
export type Categories = { categories: Category[] };

export const STARTER: Categories = {
  categories: [
    { id: "trees", name: "Trees", sizes: [{ name: "small", w: 32, h: 48 }, { name: "big", w: 48, h: 64 }] },
    { id: "rocks", name: "Rocks", sizes: [{ name: "small", w: 16, h: 16 }, { name: "big", w: 32, h: 32 }] },
    { id: "bushes", name: "Bushes", sizes: [{ name: "small", w: 16, h: 16 }, { name: "big", w: 32, h: 32 }] },
  ],
};

export function isCategories(v: unknown): v is Categories {
  const c = (v as Categories)?.categories;
  return Array.isArray(c) && c.every((x) => typeof x?.id === "string" && typeof x.name === "string" && Array.isArray(x.sizes)
    && x.sizes.every((s) => typeof s?.name === "string" && Number.isInteger(s.w) && Number.isInteger(s.h) && s.w > 0 && s.h > 0 && s.w <= 256 && s.h <= 256));
}
