import {Observable} from 'rxjs';
import {debounceTime, map} from 'rxjs/operators';
import type { UploadTaskSnapshot, UploadTask } from 'firebase/storage';

export function fromTask(task: UploadTask): Observable<UploadTaskSnapshot> {
  return new Observable<UploadTaskSnapshot>((subscriber) => {
    const progress = (snap: UploadTaskSnapshot): void => subscriber.next(snap);
    const error = (e: Error): void => subscriber.error(e);
    const complete = (): void => subscriber.complete();
    // emit the current state of the task
    progress(task.snapshot);
    // emit progression of the task
    const unsubscribeFromOnStateChanged = task.on('state_changed', progress);
    // use the promise form of task, to get the last success snapshot
    task.then(
        (snapshot) => {
          progress(snapshot);
          setTimeout(() => complete(), 0);
        },
        (e) => {
          progress(task.snapshot);
          setTimeout(() => error(e), 0);
        },
    );
    // the unsubscribe method returns by storage isn't typed in the
    // way rxjs expects, Function vs () => void, so wrap it
    return function unsubscribe() {
      unsubscribeFromOnStateChanged();
    };
  }).pipe(
      // since we're emitting first the current snapshot and then progression
      // it's possible that we could double fire synchronously; namely when in
      // a terminal state (success, error, canceled). Debounce to address.
      debounceTime(0),
  );
}

export interface PercentageSnapshot {
  progress: number;
  snapshot: UploadTaskSnapshot;
}
export function percentage(task: UploadTask): Observable<PercentageSnapshot> {
  return fromTask(task).pipe(
    map((snapshot) => ({
      progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
      snapshot,
    })),
  );
}