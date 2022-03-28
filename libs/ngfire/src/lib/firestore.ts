import { InjectionToken } from "@angular/core";
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from "firebase/firestore";
import { getConfig } from "./config";
import { initializeApp } from "firebase/app";

export const FIRESTORE = new InjectionToken<() => Firestore>('Firestore instance', {
  providedIn: 'root',
  factory: () => {
    let firestore: Firestore;
    const config = getConfig();
    return () => {
      if (!firestore) {
        const app = initializeApp(config.options, config.options.appId);
        firestore = getFirestore(app);
        if (config.firestore) config.firestore(firestore);
      }
      return firestore;
    }
  },
});
