import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseComponent } from './database.component';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';



@NgModule({
  declarations: [
    DatabaseComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild([{path: '', component: DatabaseComponent}])
  ]
})
export class DatabaseModule { }
