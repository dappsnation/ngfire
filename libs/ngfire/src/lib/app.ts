import { inject, InjectionToken } from "@angular/core";
import { FirebaseApp, initializeApp } from "firebase/app";
import { FIREBASE_CONFIG } from "./config";

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('Firebase application', {
  providedIn: 'root',
  factory: () => {
    const config = inject(FIREBASE_CONFIG);
    return initializeApp(config.options);
  },
});

