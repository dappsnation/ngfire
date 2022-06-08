import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Firestore } from 'firebase/firestore';
import { initializeFirestore } from "firebase/firestore";
import { FIRESTORE_SETTINGS, getConfig } from "../config";
import { FIREBASE_APP } from "../app";


export const FIRESTORE = new InjectionToken<Firestore>('Firestore instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const settings = inject(FIRESTORE_SETTINGS, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    const firestore = initializeFirestore(app, settings ?? {});
    if (config.firestore) config.firestore(firestore);
    return firestore;
  },
});
