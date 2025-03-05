import { isPlatformServer } from "@angular/common";
import { collectionGroup, query } from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentSnapshot, Query, QueryConstraint, DocumentData } from 'firebase/firestore';
import { keepUnstableUntilFirst, isIdList, Params } from 'ngfire/core';
import { FireCollection } from "./collection";
import { toDate } from "./utils";
import { firstValueFrom, from, Observable, of } from "rxjs";


export abstract class FireSubCollection<E extends DocumentData> extends FireCollection<E> {
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

  public getGroupRef<T extends E = E>(constraints?: QueryConstraint[]): Query<T> | undefined {
    const group = collectionGroup(this.db, this.groupId) as Query<T>;
    if (!arguments.length) return group;
    if (!constraints) return;
    return query(group, ...constraints);
  }

  /** Observable the content of group reference(s)  */
  protected fromGroupRef<T extends E = E>(ref: Query<T>): Observable<T[]> {
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => from(this.getFromRef(ref))).pipe(
        keepUnstableUntilFirst(this.zone),
      );
    }
    return this.useCache(ref);
  }


  /** Return the current value of the path from Firestore */
  public async getValue<T extends E = E>(ids?: string[], params?: Params): Promise<T[]>;
  public async getValue<T extends E = E>(params: Params): Promise<T[]>;
  public async getValue<T extends E = E>(query?: QueryConstraint[], params?: Params): Promise<T[]>;
  public async getValue<T extends E = E>(id?: string | null, params?: Params): Promise<T | undefined>;
  public async getValue<T extends E = E>(
    idOrQuery?: null | string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<T | T[] | undefined> {
    // If array is empty
    if (Array.isArray(idOrQuery) && !idOrQuery.length) return [];

    // Group query
    const isEmpty = arguments.length === 0;
    const isGroupQuery = arguments.length === 1 && Array.isArray(idOrQuery) && !isIdList(idOrQuery);

    // Collection Query
    const ref = (isEmpty || isGroupQuery)
      ? this.getGroupRef<T>(...arguments)
      : this.getRef<T>(...arguments);
    if (!ref) return;
    return this.getFromRef(ref);
  }

  /** Clear cache and get the latest value into the cache */
  public async reload<T extends E = E>(ids?: string[], params?: Params): Promise<T[]>;
  public async reload<T extends E = E>(params: Params): Promise<T[]>;
  public async reload<T extends E = E>(query?: QueryConstraint[], params?: Params): Promise<T[]>;
  public async reload<T extends E = E>(id?: string | null, params?: Params): Promise<T | undefined>;
  public async reload<T extends E = E>(
    idOrQuery?: null | string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<T | T[] | undefined> {
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
  public load<T extends E = E>(ids?: string[], params?: Params): Promise<T[]>;
  public load<T extends E = E>(params: Params): Promise<T[]>;
  public load<T extends E = E>(query?: QueryConstraint[], params?: Params): Promise<T[]>;
  public load<T extends E = E>(id?: string, params?: Params): Promise<T | undefined>;
  public load<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Promise<T | T[] | undefined>;
  public load<T extends E = E>(): Promise<T | T[] | undefined> {
    return firstValueFrom(this.valueChanges(...arguments));
  }

  /** Return the current value of the path from Firestore */
  public valueChanges<T extends E = E>(ids?: string[], params?: Params): Observable<T[]>;
  public valueChanges<T extends E = E>(params: Params): Observable<T[]>;
  public valueChanges<T extends E = E>(query?: QueryConstraint[], params?: Params): Observable<T[]>;
  public valueChanges<T extends E = E>(id?: string, params?: Params): Observable<T | undefined>;
  public valueChanges<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Observable<T | T[] | undefined>;
  public valueChanges<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | Params,
    params?: Params
  ): Observable<T | T[] | undefined> {
    // If array is empty
    if (Array.isArray(idOrQuery) && !idOrQuery.length) return of([]);
    
    // Check if group query
    const isEmpty = arguments.length === 0;
    const isGroupQuery = arguments.length === 1 && Array.isArray(idOrQuery) && !isIdList(idOrQuery);

    // Group or Collection Query
    const ref = (isEmpty || isGroupQuery)
      ? this.getGroupRef<T>(...arguments)
      : this.getRef<T>(...arguments);

    if (!ref) return of(undefined);
    return this.fromRef(ref);
  }

}