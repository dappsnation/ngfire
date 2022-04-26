import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreComponent } from './firestore.component';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    FirestoreComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild([{path: '', component: FirestoreComponent}])
  ]
})
export class FirestoreModule { }
