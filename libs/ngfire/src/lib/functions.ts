import { inject, Injectable, InjectFlags, InjectionToken } from "@angular/core";
import { getConfig, REGION_OR_DOMAIN } from "./config";
import { initializeApp } from "firebase/app";
import { getFunctions, Functions, httpsCallable, HttpsCallable, HttpsCallableOptions } from "firebase/functions";

export const CLOUD_FUNCTIONS = new InjectionToken<() => Functions>('Firebase cloud functions', {
  providedIn: 'root',
  factory: () => {
    let functions: Functions;
    const regionOrDomain = inject(REGION_OR_DOMAIN, InjectFlags.Optional);
    const config = getConfig();
    return () => {
      if (!functions) {
        const app = initializeApp(config.options, config.options.appId);
        functions = getFunctions(app, regionOrDomain ?? undefined);
        if (config.functions) config.functions(functions);
      }
      return functions;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class CallableFunctions {
  private getFunctions = inject(CLOUD_FUNCTIONS);
  private callables: Record<string, HttpsCallable> = {};

  protected get function() {
    return this.getFunctions();
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