import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { FlightService } from './service';

@Component({
  selector: 'ngfire-firestore',
  templateUrl: './firestore.component.html',
  styleUrls: ['./firestore.component.scss']
})
export class FirestoreComponent {
  form = new FormGroup({
    number: new FormControl(),
    info: new FormControl()
  });
  flight$ = this.flightService.valueChanges();

  constructor(private flightService: FlightService) {}

  add() {
    this.flightService.add(this.form.value);
  }
}
