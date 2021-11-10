import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { FlightService } from './flight.service';


@Component({
  selector: 'ngfire-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
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
