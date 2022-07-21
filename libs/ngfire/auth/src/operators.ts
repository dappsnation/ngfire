import type { Auth, User } from "firebase/auth";
import { onIdTokenChanged } from "firebase/auth";
import { Observable } from "rxjs";

export function user(auth: Auth): Observable<User|null> {
  return new Observable(subscriber => {
    const unsubscribe = onIdTokenChanged(
      auth, 
      subscriber.next.bind(subscriber), 
      subscriber.error.bind(subscriber), 
      subscriber.complete.bind(subscriber),
    );
    return { unsubscribe };
  });
}
