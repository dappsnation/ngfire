import { inject, InjectionToken } from "@angular/core";
import { FirebaseApp, initializeApp } from "firebase/app";
import { FIREBASE_APP_SETTINGS, FIREBASE_CONFIG } from "ngfire/tokens";

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('Firebase application', {
  providedIn: 'root',
  factory: () => {
    const config = inject(FIREBASE_CONFIG);
    const settings = inject(FIREBASE_APP_SETTINGS, { optional: true });
    if (config.app) {
      return config.app();
    } else {
      return initializeApp(config.options, settings ?? {});
    }
  },
});

