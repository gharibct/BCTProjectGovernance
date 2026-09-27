import type { Product } from "@/lib/api/reference-data";

const UNGROUPED_LABEL = "Other";

/**
 * `<option>`s for a Product `<select>`, grouped into `<optgroup>`s by
 * `product_group`. Groups and the products within them are sorted
 * alphabetically; products with no group fall under "Other" (last).
 */
export function ProductOptions({ products }: { products: Product[] }) {
  const byGroup = new Map<string, Product[]>();
  for (const product of products) {
    const group = product.product_group?.trim() || UNGROUPED_LABEL;
    byGroup.set(group, [...(byGroup.get(group) ?? []), product]);
  }
  const groups = [...byGroup.keys()].sort((a, b) => {
    if (a === UNGROUPED_LABEL) return 1;
    if (b === UNGROUPED_LABEL) return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {[...(byGroup.get(group) ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
            .map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
