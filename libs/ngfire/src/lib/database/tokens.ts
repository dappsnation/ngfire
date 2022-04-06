import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { initializeApp } from "firebase/app";
import { Database, getDatabase } from "firebase/database";
import { getConfig } from "../config";

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
