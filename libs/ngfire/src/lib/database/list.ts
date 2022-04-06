import { inject } from "@angular/core";
import { DatabaseReference, DataSnapshot, Query, QueryConstraint, set } from "firebase/database";
import { push, get, remove, update } from "firebase/database";
import { combineLatest, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { ExtractDeepKeys, Params } from "../types";
import { exist, isIdList, pathWithParams } from "../utils";
import { FireDatabase } from "./database";
import { serverTimestamp } from 'firebase/database';
import { fromDate, toDate } from "./utils";


function toKey(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  throw new Error('Key of list should either be a string or a number'); 
}

export function addMeta(doc: DocumentMeta, actionType: 'add' | 'update') {
  const _meta: DocumentMeta['_meta'] = doc['_meta'] ?? {};
  if (actionType === 'add') _meta.createdAt = serverTimestamp() as Date;
  if (actionType === 'update') _meta.modifiedAt = serverTimestamp() as Date;
  doc._meta = _meta;
}

export interface DocumentMeta {
  _meta: {
    createdAt?: Date;
    modifiedAt?: Date;
  }
}

export abstract class FireList<T> {
  protected fireDB = inject(FireDatabase);
  protected abstract readonly path: string;
  protected abstract dateKeys: ExtractDeepKeys<T, Date>[];
  protected idKey?: keyof T;
  protected pathKey?: keyof T;

  protected fromDatabase(snap: DataSnapshot): T | null {
    if (!snap.exists()) return null;
    const value = snap.val();
    
    const dateKeys = [...this.dateKeys, '_meta.createdAt', '_meta.modifiedAt'];
    if (!value || typeof value !== 'object') return toDate(value, dateKeys);
    if (this.idKey) value[this.idKey] = snap.key;
    if (this.pathKey) value[this.pathKey] = snap.ref.toString();
    return toDate(value, dateKeys);
  }

  protected toDatabase(doc: Partial<T>, actionType: 'add' | 'update') {
    return fromDate(doc); 
  }

  private toData(snaps: DataSnapshot | null): T | null
  private toData(snaps: DataSnapshot[]): T[]
  private toData(snaps: DataSnapshot | DataSnapshot[] | null): T | T[] | null
  private toData(snaps: DataSnapshot | DataSnapshot[] | null): T | T[] | null {
    if (!snaps) return null;
    if (Array.isArray(snaps)) return snaps.map(snap => this.toData(snap)).filter(exist);
    if (!snaps.size) return this.fromDatabase(snaps);
    const docs: (T | null)[] = [];
    // forEach cancels when return value is "true". So I return "false"
    snaps.forEach(snap => !docs.push(this.fromDatabase(snap)));
    return docs.filter(exist);
  }

  getPath(key?: string | Params, params?: Params) {
    if (typeof key === 'string') return pathWithParams(`${this.path}/${key}`, params);
    return pathWithParams(this.path, key);
  }

  getRef(): DatabaseReference
  getRef(params: Params): DatabaseReference
  getRef(key: string, params?: Params): DatabaseReference
  getRef(keys: string[], params?: Params): DatabaseReference[]
  getRef(constraints: QueryConstraint[], params?: Params): Query
  // Use internally
  getRef(query?: string | string[] | QueryConstraint[] | Params, params?: Params): DatabaseReference | DatabaseReference[] | Query
  getRef(query?: string | string[] | QueryConstraint[] | Params, params?: Params) {
    // String or Params (getPath return base path is query is Params)
    if (!Array.isArray(query)) return this.fireDB.getRef(this.getPath(query), params);
    
    return isIdList(query)
      // key list
      ? this.fireDB.getRef(query.map(key => this.getPath(key)), params)
      // query constraints
      : this.fireDB.getRef(this.getPath(), query, params);
  }

  private fromQuery(): Observable<DataSnapshot>
  private fromQuery(params: Params): Observable<DataSnapshot>
  private fromQuery(key: string, params?: Params): Observable<DataSnapshot> | Observable<null>
  private fromQuery(keys: string[], params?: Params): Observable<DataSnapshot[]>
  private fromQuery(constraints: QueryConstraint[], params?: Params): Observable<DataSnapshot[]>
  // Use internally
  private fromQuery(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Observable<DataSnapshot | DataSnapshot[] | null>
  private fromQuery(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Observable<DataSnapshot | DataSnapshot[] | null> {
    const refs = this.getRef(query, params);
    if (!Array.isArray(refs)) return this.fireDB.fromQuery(refs);
    const obs = refs.map(ref => this.fireDB.fromQuery(ref));
    return combineLatest(obs);
  }

  private getQuery(): Promise<DataSnapshot>
  private getQuery(params: Params): Promise<DataSnapshot>
  private getQuery(key: string, params?: Params): Promise<DataSnapshot> | Promise<null>
  private getQuery(keys: string[], params?: Params): Promise<DataSnapshot[]>
  private getQuery(constraints: QueryConstraint[], params?: Params): Promise<DataSnapshot[]>
  // Use internally
  private getQuery(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Promise<DataSnapshot | DataSnapshot[] | null>
  private getQuery(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Promise<DataSnapshot | DataSnapshot[] | null> {
    const refs = this.getRef(query, params);
    if (!Array.isArray(refs)) return get(refs);
    const promises = refs.map(ref => get(ref));
    return Promise.all(promises);
  }

  valueChanges(): Observable<T[]>
  valueChanges(params: Params): Observable<T[]>
  valueChanges(key: string, params?: Params): Observable<T | null>
  valueChanges(keys: string[], params?: Params): Observable<T[]>
  valueChanges(constraints: QueryConstraint[], params?: Params): Observable<T[]>
  valueChanges(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Observable<T | T[] | null> {
    if (arguments.length && !query) return of(null);
    return this.fromQuery(query, params).pipe(
      map(snap => this.toData(snap)),
    );
  }

  getValue(): Promise<T[]>
  getValue(params: Params): Promise<T[]>
  getValue(key: string, params?: Params): Promise<T | null>
  getValue(keys: string[], params?: Params): Promise<T[]>
  getValue(constraints: QueryConstraint[], params?: Params): Promise<T[]>
  getValue(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Promise<T | T[] | null> {
    if (arguments.length && !query) return Promise.resolve(null);
    return this.getQuery(query, params).then(snap => this.toData(snap));
  }

  add(value: Partial<T>, params?: Params) {
    const doc = this.toDatabase(value, 'add');
    console.log(doc);
    if (this.idKey && doc[this.idKey]) {
      const key = toKey(doc[this.idKey]);
      const ref = this.getRef(key, params);
      return set(ref, doc);
    }
    const listRef = params ? this.getRef(params) : this.getRef();
    return push(listRef, doc);
  }

  update(key: string, value: Partial<T>, params?: Params) {
    const doc = this.toDatabase(value, 'update');
    const path = this.getRef(key, params);
    return update(path, doc);
  }

  remove(key: string, params?: Params) {
    const ref = this.getRef(key, params);
    return remove(ref);
  }

  /** We use a separated method to avoid mistakes */
  removeAll(params?: Params) {
    const ref = params ? this.getRef(params) : this.getRef();
    return remove(ref);
  }
}