import { NgZone } from "@angular/core";
import { SchedulerAction, SchedulerLike, queueScheduler, Subscription, Observable, Subscriber, TeardownLogic, Operator, asyncScheduler } from "rxjs";
import { observeOn, subscribeOn, tap } from "rxjs/operators";

export class ɵZoneScheduler implements SchedulerLike {
  constructor(private zone: Zone, private delegate: SchedulerLike = queueScheduler) {}

  now() {
    return this.delegate.now();
  }

  schedule(work: (this: SchedulerAction<any>, state?: any) => void, delay?: number, state?: any): Subscription {
    const targetZone = this.zone;
    // Wrap the specified work function to make sure that if nested scheduling takes place the
    // work is executed in the correct zone
    const workInZone = function(this: SchedulerAction<any>, state: any) {
      targetZone.runGuarded(() => {
        work.apply(this, [state]);
      });
    };

    // Scheduling itself needs to be run in zone to ensure setInterval calls for async scheduling are done
    // inside the correct zone. This scheduler needs to schedule asynchronously always to ensure that
    // firebase emissions are never synchronous. Specifying a delay causes issues with the queueScheduler delegate.
    return this.delegate.schedule(workInZone, delay, state);
  }
}


function noop() {}

class BlockUntilFirstOperator<T> implements Operator<T, T> {
  private task: MacroTask | null = null;

  constructor(private zone: NgZone) {}

  call(subscriber: Subscriber<T>, source: Observable<T>): TeardownLogic {
    const unscheduleTask = this.unscheduleTask.bind(this);
    this.task = this.zone.run(() => Zone.current.scheduleMacroTask('firebaseZoneBlock', noop, {}, noop, noop));

    return source.pipe(
      tap({ next: unscheduleTask, complete: unscheduleTask, error: unscheduleTask })
    ).subscribe(subscriber).add(unscheduleTask);
  }

  private unscheduleTask() {
    // maybe this is a race condition, invoke in a timeout
    // hold for 10ms while I try to figure out what is going on
    setTimeout(() => {
      if (this.task != null && this.task.state === 'scheduled') {
        this.task.invoke();
        this.task = null;
      }
    }, 10);
  }
}


export function keepUnstableUntilFirst(ngZone: NgZone) {
  return <T>(obs$: Observable<T>): Observable<T> => {
    obs$ = obs$.lift(
      new BlockUntilFirstOperator(ngZone)
    );

    return obs$.pipe(
      // Run the subscribe body outside of Angular (e.g. calling Firebase SDK to add a listener to a change event)
      subscribeOn(ngZone.runOutsideAngular(() => new ɵZoneScheduler(Zone.current))),
      // Run operators inside the angular zone (e.g. side effects via tap())
      observeOn(ngZone.run(() => new ɵZoneScheduler(Zone.current, asyncScheduler))),
    );
  }
}