import type { CollectionReference, DocumentReference, Query } from "firebase/firestore";
import { Params } from "./types";

export function exist<D>(doc: D | undefined | null): doc is D {
  return doc !== undefined && doc !== null;
}

export function isNotUndefined<D>(doc: D | undefined): doc is D {
  return doc !== undefined;
}


//////////
// PATH //
//////////
export function isDocPath(path: string) {
  return path.split('/').length % 2 === 0;
} 

// Check if a string is a full path
export function isPathRef(path?: any): path is string {
  return !!((typeof path === "string") && (path.split('/').length > 1) && !path.includes(':'));
}

export function isIdList(idsOrQuery: any[]): idsOrQuery is string[] {
  return (idsOrQuery as any[]).every(id => typeof id === 'string');
}

/** Get the params from a path */
export function getPathParams(path: string) {
  return path
    .split('/')
    .filter((segment) => segment.charAt(0) === ':')
    .map((segment) => segment.substring(1));
}


export function assertPath(path: string) {
  for (const segment of path.split('/')) {
    if (segment.charAt(0) === ':') {
      const key = segment.substring(1);
      throw new Error(`Required parameter ${key} from ${path} has not been provided`);
    }
  }
}

export function assertCollection(path: string) {
  if (isDocPath(path)) {
    throw new Error(`Expected collection path but got: ${path}`);
  }
}

/**
 * Transform a path based on the params
 * @param path The path with params starting with "/:"
 * @param params A map of id params
 * @example pathWithParams('movies/:movieId/stakeholder/:shId', { movieId, shId })
 */
export function pathWithParams(path: string, params?: Params): string {
  if (!params) return path;
  if (!path.includes(':')) return path;
  return path
    .split('/')
    .map((segment) => {
      if (segment.charAt(0) === ':') {
        const key = segment.substr(1);
        return params[key] || segment;
      } else {
        return segment;
      }
    })
    .join('/');
}

////////////////
// REFERENCES //
////////////////
export function isQuery<E>(ref: CollectionReference<E> | DocumentReference<E> | Query<E>): ref is Query<E> {
  return ref.type === 'query';
}
export function isCollectionRef<E>(ref: CollectionReference<E> | DocumentReference<E> | Query<E>): ref is CollectionReference<E> {
  return ref.type === 'collection';
}