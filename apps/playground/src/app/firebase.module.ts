import { InjectionToken, ModuleWithProviders, NgModule } from '@angular/core';
import * as comlink from 'comlink';

const FIREBASE_WORKER = new InjectionToken<string>('FIREBASE_WORKER');

function initworker(url: string) {
  const worker = new Worker(new URL(url, import.meta.url), { type: 'module' });
  return comlink.wrap<any>(worker);
}

@NgModule({
  providers: []
})
export class FirebaseModule {
  static worker(url: string): ModuleWithProviders<FirebaseModule> {
    return {
      ngModule: FirebaseModule,
      providers: [{
        provide: FIREBASE_WORKER,
        useFactory: initworker,
        multi: true,
        deps: [url]
      }],
    };
  }
}