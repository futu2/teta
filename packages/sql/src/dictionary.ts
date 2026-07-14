/** Create a string-keyed dictionary without inherited object properties. */
export function createDictionary<Value>(
  source?: Readonly<Partial<Record<string, Value>>>
): Record<string, Value> {
  const dictionary = Object.create(null) as Record<string, Value>;
  if (source) Object.assign(dictionary, source);
  return dictionary;
}
