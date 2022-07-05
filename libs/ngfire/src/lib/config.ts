import { inject, InjectionToken } from "@angular/core";
import type { Functions, getFunctions } from "firebase/functions";
import type { FirebaseStorage, getStorage } from "firebase/storage";
import type { FirebaseApp, FirebaseAppSettings, FirebaseOptions, initializeApp } from 'firebase/app';
import type { Auth, Dependencies, initializeAuth } from "firebase/auth";
import type { Firestore, FirestoreSettings, initializeFirestore } from 'firebase/firestore';
import type { Database, getDatabase } from "firebase/database";
import type { Analytics, AnalyticsSettings, initializeAnalytics } from "firebase/analytics";

interface FirebaseConfig {
  options: FirebaseOptions,
  app?: (...params: Parameters<typeof initializeApp>) => FirebaseApp,
  firestore?: (...params: Parameters<typeof initializeFirestore>) => Firestore,
  auth?: (...params: Parameters<typeof initializeAuth>) => Auth,
  storage?: (...params: Parameters<typeof getStorage>) => FirebaseStorage,
  functions?: (...params: Parameters<typeof getFunctions>) => Functions,
  database?: (...params: Parameters<typeof getDatabase>) => Database,
  analytics?: (...params: Parameters<typeof initializeAnalytics>) => Analytics,
}

export const FIREBASE_APP_SETTINGS = new InjectionToken<FirebaseAppSettings>('FirebaseApp Configuration');
export const FIREBASE_CONFIG = new InjectionToken<FirebaseConfig>('Firebase Config');
export const REGION_OR_DOMAIN = new InjectionToken<string>('Firebase cloud functions region or domain');
export const FIRESTORE_SETTINGS = new InjectionToken<FirestoreSettings>('Firestore settings');
export const ANALYTICS_SETTINGS = new InjectionToken<AnalyticsSettings>('Analytics settings');
export const STORAGE_BUCKET = new InjectionToken<string>('The gs:// url to your Firebase Storage Bucket.');
export const DB_URL = new InjectionToken<string>('The URL of the Realtime Database instance to connect to');
export const AUTH_DEPS = new InjectionToken<Dependencies>('The dependencies that can be used to initialize an Auth instance.');

export function getConfig() {
  try {
    return inject(FIREBASE_CONFIG);
  } catch (err) {
    const message= `You should add FIREBASE_CONFIG token to you root module providers (probably AppModule).
Example:
  
@NgModule({
  declarations: [...],
  imports: [...],
  providers: [{ provide: FIREBASE_CONFIG, useValue: environment.firebase }] <--- Add this
  ...
})

Original message: ${(err as Error).message}`;
    throw new Error(message);
  }
}