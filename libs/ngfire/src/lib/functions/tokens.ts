import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Functions, getFunctions } from "firebase/functions";
import { FIREBASE_APP } from "../app";
import { getConfig, REGION_OR_DOMAIN } from "../config";

export const CLOUD_FUNCTIONS = new InjectionToken<Functions>('Firebase cloud functions', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const regionOrDomain = inject(REGION_OR_DOMAIN, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    if (config.functions) {
      return config.functions(app, regionOrDomain ?? undefined);
    } else {
      return getFunctions(app, regionOrDomain ?? undefined);
    }
  },
});
