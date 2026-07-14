export function createStringRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function setStringRecordValue<T>(
  record: Record<string, T>,
  key: string,
  value: T
): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function hasOwnStringKey(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
