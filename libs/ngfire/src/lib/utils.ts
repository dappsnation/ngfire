import { Params } from "./types";

export function exist<D>(doc: D | undefined | null): doc is D {
  return doc !== undefined && doc !== null;
}


///////////////
// TIMESTAMP //
///////////////







//////////
// PATH //
//////////

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
    .map((segment) => segment.substr(1));
}


export function assertPath(path: string) {
  for (const segment of path.split('/')) {
    if (segment.charAt(0) === ':') {
      const key = segment.substr(1);
      throw new Error(`Required parameter ${key} from ${path} has not been provided`);
    }
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

