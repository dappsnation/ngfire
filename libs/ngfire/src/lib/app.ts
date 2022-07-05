import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { FirebaseApp, initializeApp } from "firebase/app";
import { FIREBASE_APP_SETTINGS, FIREBASE_CONFIG } from "./config";

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('Firebase application', {
  providedIn: 'root',
  factory: () => {
    const config = inject(FIREBASE_CONFIG);
    const settings = inject(FIREBASE_APP_SETTINGS, InjectFlags.Optional);
    if (config.app) {
      return config.app(config.options, settings ?? {});
    } else {
      return initializeApp(config.options, settings ?? {});
    }
  },
});

