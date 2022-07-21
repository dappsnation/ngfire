import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Firestore } from 'firebase/firestore';
import { initializeFirestore } from "firebase/firestore";
import { FIRESTORE_SETTINGS, getConfig } from "ngfire/tokens";
import { FIREBASE_APP } from "ngfire/app";


export const FIRESTORE = new InjectionToken<Firestore>('Firestore instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const settings = inject(FIRESTORE_SETTINGS, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    if (config.firestore) {
      return config.firestore(app, settings ?? {});
    } else {
      return initializeFirestore(app, settings ?? {});
    }
  },
});
