import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { FIREBASE_APP } from "ngfire/app";
import { AUTH_DEPS, getConfig } from "ngfire/tokens";

export const FIRE_AUTH = new InjectionToken<Auth>('Fire auth instance', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const app = inject(FIREBASE_APP);
    const deps = inject(AUTH_DEPS, InjectFlags.Optional) || undefined;
    if (config.auth) {
      return config.auth(app, deps);
    } else {
      return deps ? initializeAuth(app, deps) : getAuth(app);
    }
  },
});

