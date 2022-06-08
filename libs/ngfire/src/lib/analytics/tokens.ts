import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Analytics, initializeAnalytics } from "firebase/analytics";
import { ANALYTICS_SETTINGS, getConfig } from "../config";
import { FIREBASE_APP } from "../app";


export const FIRE_ANALYTICS = new InjectionToken<Analytics>('Firebase Analytics instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const settings = inject(ANALYTICS_SETTINGS, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    const analytics = initializeAnalytics(app, settings ?? {});
    if (config.analytics) config.analytics(analytics);
    return analytics;
  },
});
