import type { ConstraintParams, FirestoreApi, QueryOptions } from '@ngfire/webworker';
import type { limit, where } from 'firebase/firestore';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as comlink from 'comlink';

class ConstraintRef {
  query: ConstraintParams[] = [];
  where(...payload: Parameters<typeof where>) {
    this.query.push({ type: 'where', payload });
    return this;
  }
  limit(...payload: Parameters<typeof limit>) {
    this.query.push({ type: 'limit', payload });
    return this;
  }
}

type QueryFn = (ref: ConstraintRef) => ConstraintRef;

@Injectable({ providedIn: 'root' })
export class Firestore {
  private _db?: FirestoreApi;


  constructor() {}

  get db(): FirestoreApi {
    if (!this._db) {
      const worker = new Worker(new URL('./firebase/firebase.worker', import.meta.url), { type: 'module' });
      const firebase = comlink.wrap<any>(worker);
      this._db = firebase.firestore;
    }
    return this._db!;
  }

  setDoc<T>(path: string, value: Partial<T> = {}) {
    return this.db.setDoc<T>(path, value);
  }

  getValue<T = unknown>(paths: string, options?: QueryOptions): Promise<T | undefined>
  getValue<T = unknown>(paths: string[], options?: QueryOptions): Promise<(T | undefined)[]>
  getValue<T = unknown>(paths: string | string[], options?: QueryOptions) {
    return Array.isArray(paths)
      ? this.db.getDoc<T>(paths, options)
      : this.db.getDoc<T>(paths, options);
  }

  valueChanges<T = any>(path: string, queryFn: QueryFn = ref => ref, options: QueryOptions = {}) {
    const { query } = queryFn(new ConstraintRef());
    return new Observable<T | T[] | undefined>(subject => {
      const cb = comlink.proxy((data: T | T[] | undefined) => subject.next(data));
      const id$ = this.db.onSnapshot(path, query, options, cb);
      return () => id$.then(id => this.db.unsubscribe(id));
    });
  }
}
