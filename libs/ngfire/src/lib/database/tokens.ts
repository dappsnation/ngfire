import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Database, getDatabase } from "firebase/database";
import { FIREBASE_APP } from "../app";
import { getConfig } from "../config";

export const DB_URL = new InjectionToken<string>('The URL of the Realtime Database instance to connect to');

export const DATABASE = new InjectionToken<Database>('Database instance', {
  providedIn: 'root',
  factory: () => {
    const url = inject(DB_URL, InjectFlags.Optional);
    const config = getConfig();
    const app = inject(FIREBASE_APP);
    const db = getDatabase(app, url ?? undefined);
    if (config.database) config.database(db);
    return db;
  },
});
