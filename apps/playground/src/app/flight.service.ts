import { Injectable } from '@angular/core';
import { FireCollection } from 'ngfire';

export interface Flight {
  number: string;
  info: string;
}

@Injectable({ providedIn: 'root' })
export class FlightService extends FireCollection<Flight> {
  readonly path = 'flights';
}