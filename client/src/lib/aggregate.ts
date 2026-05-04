export interface AggregateInput {
  dish: string;
  price_cents: number | null;
}

export interface AggregateRow<T> {
  key: string;
  dish: string;
  count: number;
  totalCents: number;
  items: T[];
}

export function aggregateByDish<T extends AggregateInput>(items: T[]): AggregateRow<T>[] {
  const map = new Map<string, AggregateRow<T>>();
  for (const item of items) {
    const key = item.dish.trim().toLowerCase();
    let row = map.get(key);
    if (!row) {
      row = { key, dish: item.dish.trim(), count: 0, totalCents: 0, items: [] };
      map.set(key, row);
    }
    row.count += 1;
    row.totalCents += item.price_cents ?? 0;
    row.items.push(item);
  }
  return [...map.values()];
}
