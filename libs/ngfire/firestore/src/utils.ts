import { Timestamp } from "firebase/firestore";

/** Return the full path of the doc */
export function getDocPath(path: string, id: string) {
  // If path is smaller than id, id is the full path from ref
  return path.split('/').length < id.split('/').length ? id : `${path}/${id}`;
}

/** Recursively all Timestamp into Date */
export function toDate<D>(target: D): D {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    if (!value || typeof value !== 'object') continue;
    if (value instanceof Timestamp) {
      target[key] = value.toDate() as any;
      continue;
    }
    toDate(value)
  }
  return target;
}



export function fromTransferStore<T>(target: T) {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    if (typeof value === 'string') {
      const [dateKey, date] = value.split('::');
      if (dateKey !== '__date__') continue;
      target[key] = new Date(date) as any;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    fromTransferStore(value)
  }
  return target;
}

export function toTransferStore<T>(target: T) {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    if (!value || typeof value !== 'object') continue;
    if (value instanceof Date) {
      target[key] = `__date__::${value.toISOString()}` as any;
      continue;
    }
    toTransferStore(value)
  }
  return target;
}