import type { FireApi, QueryConstaint } from '@ngfire/webworker';
import type { limit, where } from 'firebase/firestore';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as comlink from 'comlink';

type API = comlink.Remote<FireApi>;

class ConstraintRef {
  query: QueryConstaint[] = [];
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
  db: API['firestore'];
  constructor() {
    const worker = new Worker('./firebase/firebase.worker', { type: 'module' });
    const firebase = comlink.wrap<FireApi>(worker);
    this.db = firebase.firestore;
  }

  valueChanges<T = any>(path: string, queryFn: QueryFn = ref => ref) {
    const { query } = queryFn(new ConstraintRef());
    return new Observable<T>(subject => {
      const cb = comlink.proxy((data: T) => subject.next(data));
      const id$ = this.db.onSnapshot(path, query, cb);
      return () => id$.then(id => this.db.unsubscribe(id));
    });
  }
}
