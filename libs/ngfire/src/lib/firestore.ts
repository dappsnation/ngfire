import { inject, InjectionToken } from "@angular/core";
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from "firebase/firestore";
import { FIREBASE_CONFIG } from "./config";
import { initializeApp } from "firebase/app";

export const FIRESTORE = new InjectionToken<() => Firestore>('Firestore instance', {
  providedIn: 'root',
  factory: () => {
    let firestore: Firestore;
    const config = inject(FIREBASE_CONFIG);
    const app = initializeApp(config.options, config.options.appId);
    return () => {
      if (!firestore) {
        firestore = getFirestore(app);
        if (config.firestore) config.firestore(firestore);
      }
      return firestore;
    }
  },
});
