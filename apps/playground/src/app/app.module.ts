import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FIREBASE_CONFIG } from 'ngfire';
import { environment } from '../environments/environment';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    RouterModule.forRoot([{
      path: '',
      redirectTo: 'firestore',
      pathMatch: 'full'
    },{
      path: 'firestore',
      loadChildren: () => import('./firestore/firestore.module').then(m => m.FirestoreModule)
    }, {
      path: 'database',
      loadChildren: () => import('./database/database.module').then(m => m.DatabaseModule)
    }])
  ],
  providers: [{ provide: FIREBASE_CONFIG, useValue: environment.firebase }],
  bootstrap: [AppComponent],
})
export class AppModule {}
