/** Recursively all Date into Timestamp */
export function fromDate<D>(target: D): D {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    if (!value || typeof value !== 'object') continue;
    if (value instanceof Date) {
      target[key] = value.getTime() as any;
      continue;
    }
    fromDate(value)
  }
  return target;
}

/** Recursively all Date into Timestamp */
export function toDate<D>(target: D, dateKeys: string[], path: string = ''): D {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    const deepKey = `${path}.${key}`;
    if (dateKeys.includes(deepKey)) {
      if (typeof value !== 'number') throw new Error(`Date key "${deepKey}" is not a number. Got ${value}`);
      target[key] = new Date(value) as any;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    toDate(value, dateKeys, deepKey);
  }
  return target;
}


