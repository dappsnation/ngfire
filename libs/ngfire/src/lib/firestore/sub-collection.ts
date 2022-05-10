import { collectionGroup, query } from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentSnapshot, Query, QueryConstraint } from 'firebase/firestore';
import { FireCollection, toDate } from "./collection";
import { isIdList } from '../utils';
import { Params } from '../types'
import { firstValueFrom, from, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { isPlatformServer } from "@angular/common";
import { keepUnstableUntilFirst } from "../zone";


/** Get the params from a path */
export function getPathParams(path: string) {
  return path
    .split('/')
    .filter((segment) => segment.charAt(0) === ':')
    .map((segment) => segment.substring(1));
}

export abstract class FireSubCollection<E> extends FireCollection<E> {
  abstract path: string;
  protected pathKey = 'path';
  
  get groupId() {
    return this.path.split('/').pop() as string;
  }

  /** Function triggered when getting data from firestore */
  protected fromFirestore(snapshot: DocumentSnapshot<E> | QueryDocumentSnapshot<E>): E | undefined {
    if (snapshot.exists()) {
      return {
        ...toDate(snapshot.data()),
        [this.idKey]: snapshot.id,
        [this.pathKey]: snapshot.ref.path
      };
    } else {
      return undefined;
    }
  }

  public getGroupRef(constraints?: QueryConstraint[]): Query<E> | undefined {
    const group = collectionGroup(this.db, this.groupId) as Query<E>;
    if (!arguments.length) return group;
    if (!constraints) return;
    return query(group, ...constraints);
  }

  /** Observable the content of group reference(s)  */
  protected fromGroupRef(ref: Query<E>): Observable<E[]> {
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => from(this.getFromRef(ref))).pipe(
        keepUnstableUntilFirst(this.zone),
      );
    }
    return this.useCache(ref);
  }


  /** Return the current value of the path from Firestore */
  public async getValue(ids?: string[], params?: Params): Promise<E[]>;
  public async getValue(params: Params): Promise<E[]>;
  public async getValue(query?: QueryConstraint[], params?: Params): Promise<E[]>;
  public async getValue(id?: string | null, params?: Params): Promise<E | undefined>;
  public async getValue(
    idOrQuery?: null | string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<E | E[] | undefined> {
    // If array is empty
    if (Array.isArray(idOrQuery) && !idOrQuery.length) return [];

    // Group query
    const isEmpty = arguments.length === 0;
    const isGroupQuery = arguments.length === 1 && Array.isArray(idOrQuery) && !isIdList(idOrQuery);

    // Collection Query
    const ref = (isEmpty || isGroupQuery)
      ? this.getGroupRef(...arguments)
      : this.getRef(...arguments);
    if (!ref) return;
    return this.getFromRef(ref);
  }

  /** Clear cache and get the latest value into the cache */
  public async reload(ids?: string[], params?: Params): Promise<E[]>;
  public async reload(params: Params): Promise<E[]>;
  public async reload(query?: QueryConstraint[], params?: Params): Promise<E[]>;
  public async reload(id?: string | null, params?: Params): Promise<E | undefined>;
  public async reload(
    idOrQuery?: null | string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<E | E[] | undefined> {
    const isEmpty = arguments.length === 0;
    const isGroupQuery = arguments.length === 1 && Array.isArray(idOrQuery) && !isIdList(idOrQuery);
    const ref = (isEmpty || isGroupQuery)
      ? this.getGroupRef(...arguments)
      : this.getRef(...arguments);
    if (!ref) return;
    if (this.memorize) {
      Array.isArray(ref)
        ? ref.forEach(r => this.clearCache(r))
        : this.clearCache(ref);
    }
    return this.load(...arguments);
  }
  

  /** Get the last content from the app (if value has been cached, it won't do a server request)  */
  public load(ids?: string[], params?: Params): Promise<E[]>;
  public load(params: Params): Promise<E[]>;
  public load(query?: QueryConstraint[], params?: Params): Promise<E[]>;
  public load(id?: string, params?: Params): Promise<E | undefined>;
  public load(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<E | E[] | undefined>;
  public load(): Promise<E | E[] | undefined> {
    return firstValueFrom(this.valueChanges(...arguments));
  }

  /** Return the current value of the path from Firestore */
  public valueChanges(ids?: string[], params?: Params): Observable<E[]>;
  public valueChanges(params: Params): Observable<E[]>;
  public valueChanges(query?: QueryConstraint[], params?: Params): Observable<E[]>;
  public valueChanges(id?: string, params?: Params): Observable<E | undefined>;
  public valueChanges(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Observable<E | E[] | undefined>;
  public valueChanges(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Observable<E | E[] | undefined> {
    // If array is empty
    if (Array.isArray(idOrQuery) && !idOrQuery.length) return of([]);
    
    // Check if group query
    const isEmpty = arguments.length === 0;
    const isGroupQuery = arguments.length === 1 && Array.isArray(idOrQuery) && !isIdList(idOrQuery);

    // Group or Collection Query
    const ref = (isEmpty || isGroupQuery)
      ? this.getGroupRef(...arguments)
      : this.getRef(...arguments);

    if (!ref) return of(undefined);
    return this.fromRef(ref);
  }

}