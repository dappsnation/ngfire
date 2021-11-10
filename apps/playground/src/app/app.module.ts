import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { FIREBASE_CONFIG } from 'libs/ngfire/src/lib/config';
import { environment } from '../environments/environment';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, ReactiveFormsModule],
  providers: [{ provide: FIREBASE_CONFIG, useValue: environment.firebase }],
  bootstrap: [AppComponent],
})
export class AppModule {}
