import { inject, Injectable, Injector } from "@angular/core";
import { QueryConstraint, ref as dbRef, remove, set, update, query as queryWithConstraints, DataSnapshot } from 'firebase/database';
import type { DatabaseReference, Query } from 'firebase/database';
import { Observable } from "rxjs";
import { Params } from "../types";
import { fromQuery } from "./operators";
import { DATABASE } from "./tokens";
import { assertPath, pathWithParams } from "../utils";


export function isContraintList(idsOrQuery: any[]): idsOrQuery is QueryConstraint[] {
  return idsOrQuery.every(query => query instanceof QueryConstraint);
}

@Injectable({ providedIn: 'root' })
export class FireDatabase {
  protected injector = inject(Injector);
  protected memory = new Map<Query, Observable<DataSnapshot>>();

  get db() {
    return this.injector.get(DATABASE);
  }

  /** Get the reference of the document, collection or query */
  public getRef(path: string, params?: Params): DatabaseReference;
  public getRef(paths: string[], params?: Params): DatabaseReference[];
  public getRef(path: string, constraints: QueryConstraint[], params?: Params): Query;
  public getRef(paths: string[], constraints: QueryConstraint[], params?: Params): Query;
  // overload used internally when looping over paths array
  public getRef(paths: string, constraints?: Params | QueryConstraint[], params?: Params): Query | DatabaseReference;
  public getRef(
    paths: string | string[],
    paramsOrConstraints?: Params | QueryConstraint[],
    params?: Params
  ): undefined | Query | Query[] | DatabaseReference | DatabaseReference[] {
    if (!arguments.length || !paths) return undefined;
    const hasContraints = Array.isArray(paramsOrConstraints);

    if (Array.isArray(paths)) {
      return paths.map((path) => this.getRef(path, paramsOrConstraints, params));
    }

    if (hasContraints) {
      const path = pathWithParams(paths, params);
      assertPath(path);
      const ref = dbRef(this.db, path);
      return queryWithConstraints(ref, ...paramsOrConstraints);
    } else {
      const path = pathWithParams(paths, paramsOrConstraints);
      assertPath(path);
      return dbRef(this.db, path);
    }
  }

  fromQuery(query: Query) {
    let existing: Observable<DataSnapshot> | null = null;
    for (const [key, value] of this.memory.entries()) {
      if (query.isEqual(key)) {
        existing = value;
        break;
      }
    }
    if (existing) return existing;
    this.memory.set(query, fromQuery(query));
    return this.memory.get(query) as Observable<DataSnapshot>;
  }

  create<T>(path: string, content: T) {
    return set(this.getRef(path), content);
  }

  update<T>(path: string, value: Partial<T>) {
    const ref = this.getRef(path);
    return update(ref, value);
  }

  remove(path: string) {
    const ref = this.getRef(path);
    return remove(ref);
  }
}
