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


// Code from https://gist.github.com/davehax/2f32e7b09c3da3531601e6543fcff82e
export function dateReviver(key: string, value: unknown) {
  const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,}|)Z$/;
  if (typeof value === "string" && dateFormat.test(value)) {
      return new Date(value);
  }
  return value;
}