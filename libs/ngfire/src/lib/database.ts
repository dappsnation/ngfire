import { inject, Injectable, InjectFlags, InjectionToken } from "@angular/core";
import { Database, getDatabase, Query, ref, set } from 'firebase/database';
import { getConfig } from "./config";
import { initializeApp } from "firebase/app";
import { Observable } from "rxjs";

export const DB_URL = new InjectionToken<string>('The URL of the Realtime Database instance to connect to');

export const DATABASE = new InjectionToken<() => Database>('Database instance', {
  providedIn: 'root',
  factory: () => {
    let db: Database;
    const url = inject(DB_URL, InjectFlags.Optional);
    const config = getConfig();
    return () => {
      if (!db) {
        const app = initializeApp(config.options, config.options.appId);
        db = getDatabase(app, url ?? undefined);
        if (config.database) config.database(db);
      }
      return db;
    }
  },
});


@Injectable({ providedIn: 'root' })
export class FireDatabase {
  protected getDB = inject(DATABASE);
  protected memory = new Map<Query, Observable<unknown>>();

  get db() {
    return this.getDB();
  }

  getRef(path: string) {
    return ref(this.db, path);
  }

  valueChanges<T>(query: Query): Observable<T> {
    let existing: Observable<unknown> | null = null;
    for (const [key, value] of this.memory.entries()) {
      if (query.isEqual(key)) {
        existing = value;
        break;
      }
    }
    if (existing) return existing as Observable<T>;
    const obs = new Observable();
    this.memory.set(query, obs);
    return this.memory.get(query) as Observable<T>;
  }

  create<T>(path: string, content: T) {
    return set(this.getRef(path), content);
  }

}


export abstract class FireList<T> {
  protected fireDB = inject(FireDatabase);
  protected abstract readonly path: string;  
}