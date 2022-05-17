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

interface ToDataOptions {
  isList: boolean;
}

function isListQuery(query?: string | string[] | QueryConstraint[] | Params) {
  if (typeof query === 'string') return false;
  if (Array.isArray(query) && isIdList(query)) return false;
  return true;
}


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

export abstract class FireList<E> {
  protected fireDB = inject(FireDatabase);
  protected abstract readonly path: string;
  protected abstract dateKeys: ExtractDeepKeys<E, Date>[];
  protected idKey?: keyof E;
  protected pathKey?: keyof E;

  protected fromDatabase<T extends E = E>(snap: DataSnapshot): T | null {
    if (!snap.exists()) return null;
    const value = snap.val();
    
    const dateKeys = [...this.dateKeys, '_meta.createdAt', '_meta.modifiedAt'];
    if (!value || typeof value !== 'object') return toDate(value, dateKeys);
    if (this.idKey) value[this.idKey] = snap.key;
    if (this.pathKey) value[this.pathKey] = snap.ref.toString();
    return toDate(value, dateKeys);
  }

  protected toDatabase<T extends E = E>(doc: Partial<T>, actionType: 'add' | 'update') {
    return fromDate(doc); 
  }

  private toData<T extends E = E>(snaps: DataSnapshot | null, options: ToDataOptions): T | null
  private toData<T extends E = E>(snaps: DataSnapshot[], options: ToDataOptions): T[]
  private toData<T extends E = E>(snaps: DataSnapshot | DataSnapshot[] | null, options: ToDataOptions): T | T[] | null
  private toData<T extends E = E>(snaps: DataSnapshot | DataSnapshot[] | null, options: ToDataOptions): T | T[] | null {
    if (!snaps) return null;
    if (Array.isArray(snaps)) return snaps.map(snap => this.toData<T>(snap, { isList: false })).filter(exist);
    if (!options.isList) return this.fromDatabase<T>(snaps);
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

  valueChanges<T extends E = E>(): Observable<T[]>
  valueChanges<T extends E = E>(params: Params): Observable<T[]>
  valueChanges<T extends E = E>(key: string, params?: Params): Observable<T | null>
  valueChanges<T extends E = E>(keys: string[], params?: Params): Observable<T[]>
  valueChanges<T extends E = E>(constraints: QueryConstraint[], params?: Params): Observable<T[]>
  valueChanges<T extends E = E>(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Observable<T | T[] | null> {
    if (arguments.length && !query) return of(null);
    return this.fromQuery(query, params).pipe(
      map(snap => this.toData(snap, { isList: isListQuery(query) })),
    );
  }

  getValue<T extends E = E>(): Promise<T[]>
  getValue<T extends E = E>(params: Params): Promise<T[]>
  getValue<T extends E = E>(key: string, params?: Params): Promise<T | null>
  getValue<T extends E = E>(keys: string[], params?: Params): Promise<T[]>
  getValue<T extends E = E>(constraints: QueryConstraint[], params?: Params): Promise<T[]>
  async getValue<T extends E = E>(query?: string | string[] | QueryConstraint[] | Params, params?: Params): Promise<T | T[] | null> {
    if (arguments.length && !query) return Promise.resolve(null);
    const snap = await this.getQuery(query, params)
    return this.toData<T>(snap, { isList: isListQuery(query) });
  }

  add<T extends E>(value: Partial<T>, params?: Params) {
    const doc = this.toDatabase(value, 'add');
    if (this.idKey && doc[this.idKey]) {
      const key = toKey(doc[this.idKey]);
      const ref = this.getRef(key, params);
      return set(ref, doc);
    }
    const listRef = params ? this.getRef(params) : this.getRef();
    return push(listRef, doc);
  }

  update<T extends E>(key: string, value: Partial<T>, params?: Params) {
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