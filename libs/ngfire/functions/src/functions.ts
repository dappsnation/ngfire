import { inject, Injectable, Injector } from "@angular/core";
import { httpsCallable, HttpsCallable, HttpsCallableOptions } from "firebase/functions";
import { CLOUD_FUNCTIONS } from "./tokens";


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