export class ByteCache<T> {
  private entries = new Map<string, { value: T; size: number }>();
  private used = 0;
  constructor(private readonly budget: number, private readonly dispose?: (value: T) => void) {}
  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, size: number) {
    this.remove(key);
    if (size > this.budget) return;
    while (this.used + size > this.budget && this.entries.size) this.remove(this.entries.keys().next().value!);
    this.entries.set(key, { value, size });
    this.used += size;
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) { this.used -= entry.size; this.dispose?.(entry.value); this.entries.delete(key); }
  }
  clear() { for (const key of this.entries.keys()) this.remove(key); }
}
