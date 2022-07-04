import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Database, getDatabase } from "firebase/database";
import { FIREBASE_APP } from "../app";
import { DB_URL, getConfig } from "../config";


export const DATABASE = new InjectionToken<Database>('Database instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const app = inject(FIREBASE_APP);
    const url = inject(DB_URL, InjectFlags.Optional);
    if (config.database) {
      return config.database(app, url ?? undefined)
    } else {
      return getDatabase(app, url ?? undefined);
    }
  },
});
