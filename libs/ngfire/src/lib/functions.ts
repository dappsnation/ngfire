import { inject, Injectable, InjectFlags, InjectionToken, Injector } from "@angular/core";
import { getConfig, REGION_OR_DOMAIN } from "./config";
import { getFunctions, Functions, httpsCallable, HttpsCallable, HttpsCallableOptions } from "firebase/functions";
import { FIREBASE_APP } from "./app";

export const CLOUD_FUNCTIONS = new InjectionToken<Functions>('Firebase cloud functions', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const regionOrDomain = inject(REGION_OR_DOMAIN, InjectFlags.Optional);
    const app = inject(FIREBASE_APP);
    const functions = getFunctions(app, regionOrDomain ?? undefined);
    if (config.functions) config.functions(functions);
    return functions;
  },
});

@Injectable({ providedIn: 'root' })
export class CallableFunctions {
  private injector = inject(Injector);
  private callables: Record<string, HttpsCallable> = {};

  protected get function() {
    return this.injector.get(CLOUD_FUNCTIONS);
  }

  prepare<I, O>(name: string): (data: I) => Promise<O> {
    if (!this.callables[name]) {
      this.callables[name] = httpsCallable(this.function, name);
    }
    return (data: I) => this.call(name, data);
  }

  async call<I, O>(
    name: string,
    data: I,
    options?: HttpsCallableOptions 
  ): Promise<O> {
    if (!this.callables[name]) {
      this.callables[name] = httpsCallable(this.function, name, options);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.callables[name]!(data);
    return result.data as any;
  }
}