import { inject, InjectFlags, InjectionToken } from "@angular/core";
import type { Firestore } from 'firebase/firestore';
import { initializeFirestore } from "firebase/firestore";
import { FIRESTORE_SETTINGS, getConfig } from "./config";
import { initializeApp } from "firebase/app";

export const FIRESTORE = new InjectionToken<() => Firestore>('Firestore instance', {
  providedIn: 'root',
  factory: () => {
    let firestore: Firestore;
    const config = getConfig();
    const settings = inject(FIRESTORE_SETTINGS, InjectFlags.Optional);
    return () => {
      if (!firestore) {
        const app = initializeApp(config.options, config.options.appId);
        firestore = initializeFirestore(app, settings ?? {});
        if (config.firestore) config.firestore(firestore);
      }
      return firestore;
    }
  },
});
