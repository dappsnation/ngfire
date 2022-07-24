import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Analytics, initializeAnalytics } from "firebase/analytics";
import { ANALYTICS_SETTINGS, getConfig } from "ngfire/tokens";
import { FIREBASE_APP } from "ngfire/app";


export const FIRE_ANALYTICS = new InjectionToken<Analytics>('Firebase Analytics instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const settings = inject(ANALYTICS_SETTINGS, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    if (config.analytics) {
      return config.analytics(app, settings ?? {});
    } else {
      return initializeAnalytics(app, settings ?? {});
    }
  },
});
