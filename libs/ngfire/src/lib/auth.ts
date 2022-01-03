import { inject, Injectable, InjectionToken, NgZone, PLATFORM_ID } from "@angular/core";
import { Auth, getAuth, UserCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut, signInAnonymously, signInWithPopup, signInWithCustomToken, AuthProvider, User, getAdditionalUserInfo } from "firebase/auth";
import { getConfig } from "./config";
import { initializeApp } from "firebase/app";
import { FIRESTORE } from "./firestore";
import { filter, map, switchMap, take } from "rxjs/operators";
import { doc, getDoc, writeBatch, runTransaction } from "firebase/firestore";
import type { WriteBatch, DocumentSnapshot, DocumentReference, UpdateData } from 'firebase/firestore';
import { user, fromRef } from './operators';
import { from, Observable, of } from "rxjs";
import { AtomicWrite, MetaDocument, UpdateCallback } from "./types";
import { shareWithDelay } from "./operators";
import { isPlatformServer } from "@angular/common";
import { keepUnstableUntilFirst } from "./zone";

const exist = <T>(v?: T | null): v is T => v !== null && v !== undefined;

export const FIRE_AUTH = new InjectionToken<() => Auth>('Fire auth instance', {
  providedIn: 'root',
  factory: () => {
    let auth: Auth;
    const config = getConfig();
    return () => {
      if (!auth) {
        const app = initializeApp(config.options, config.options.appId);
        auth = getAuth(app);
        if (config.auth) config.auth(auth);
      }
      return auth;
    };
  },
});


export interface AuthWriteOptions<Ctx = any> {
  write?: AtomicWrite;
  ctx?: Ctx;
  collection?: null | string;
}


/**
 * Get the custom claims of a user. If no key is provided, return the whole claims object
 * @param user The user object returned by Firebase Auth
 * @param roles Keys of the custom claims inside the claim objet
 */
export async function getCustomClaims<Claims extends Record<string, any>>(
  user: User,
  keys?: string | string[]
): Promise<Claims> {
  if (!user) return {} as Claims;
  const { claims } = await user.getIdTokenResult();
  if (!keys) return claims as Claims;

  const fields = Array.isArray(keys) ? keys : [keys];
  const result: Record<string, any> = {};
  for (const key of fields) {
    if (claims[key]) {
      result[key] = claims[key];
    }
  }
  return result as Claims;
}


export function isUpdateCallback<T>(
  update: UpdateCallback<T> | Partial<T>
): update is UpdateCallback<T> {
  return typeof update === 'function';
}



@Injectable({ providedIn: 'root' })
export abstract class BaseFireAuth<Profile, Roles = undefined> {
  private memoProfile: Record<string, Observable<DocumentSnapshot<Profile>>> = {};
  private platformId = inject(PLATFORM_ID);
  protected getAuth = inject(FIRE_AUTH);
  protected getFirestore = inject(FIRESTORE);
  private zone = inject(NgZone);
  
  protected abstract path: string | undefined;
  protected idKey = 'id';
  protected verificationUrl?: string;

  protected abstract signin(...arg: any[]): Promise<UserCredential>;
  protected abstract signOut(): Promise<void>;

  protected get db() {
    return this.getFirestore();
  }
  
  get auth() {
    return this.getAuth();
  }

  get user() {
    return this.auth.currentUser;
  }

  user$ = isPlatformServer(this.platformId)
    ? this.zone.runOutsideAngular(() => user(this.auth))
    : user(this.auth).pipe(shareWithDelay());
  
  /**
   * Observe current user. Doesn't emit if there are no user connected.
   * Use `user` if you need to know if user is connected
   */
  currentUser$ = this.user$.pipe(filter(exist));

  /** Listen on changes from the authenticated user */
  profile$ = this.user$.pipe(
    map((user) => this.getRef({ user })),
    switchMap((ref) => (ref ? this.useMemo(ref) : of(undefined))),
    map(snapshot => snapshot ? this.fromFirestore(snapshot) : undefined),
  );

  /** Triggered when the profile has been created */
  protected onCreate?(profile: Partial<Profile>, options: AuthWriteOptions): unknown;
  /** Triggered when the profile has been updated */
  protected onUpdate?(profile: Partial<Profile>, options: AuthWriteOptions): unknown;
  /** Triggered when the profile has been deleted */
  protected onDelete?(options: AuthWriteOptions): unknown;
  /** Triggered when user signin for the first time or signup with email & password */
  protected onSignup?(credential: UserCredential, options: AuthWriteOptions): unknown;
  /** Triggered when a user signin, except for the first time @see onSignup */
  protected onSignin?(credential: UserCredential): unknown;
  /** Triggered when a user signout */
  protected onSignout?(): unknown;

  protected useMemo(ref: DocumentReference<Profile>) {
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => from(getDoc(ref))).pipe(keepUnstableUntilFirst(this.zone));
    }
    if (!this.memoProfile[ref.path]) {
      this.memoProfile[ref.path] = fromRef(ref).pipe(shareWithDelay());
    }
    return this.memoProfile[ref.path];
  }

  /**
   * Select the roles for this user. Can be in custom claims or in a Firestore collection
   * @param user The user given by FireAuth
   * @see getCustomClaims to get the custom claims out of the user
   * @note Can be overwritten
   */
  protected selectRoles(user: User): Promise<Roles> | Observable<Roles> {
    return getCustomClaims<Roles>(user);
  }

  /**
   * Function triggered when getting data from firestore
   * @note should be overwritten
   */
  protected fromFirestore(snapshot: DocumentSnapshot<Profile>) {
    return snapshot.exists()
      ? ({ ...snapshot.data(), [this.idKey]: snapshot.id } as Profile)
      : undefined;
  }

  /**
   * Function triggered when adding/updating data to firestore
   * @note should be overwritten
   */
  protected toFirestore(profile: Partial<Profile>, actionType: 'add' | 'update'): any {
    if (actionType === 'add') {
      const _meta: MetaDocument = { createdAt: new Date(), modifiedAt: new Date() };
      return { _meta, ...profile };
    } else {
      return { '_meta.modifiedAt': new Date(), ...profile };
    }
  }

  /**
   * Function triggered when transforming a user into a profile
   * @param user The user object from FireAuth
   * @param ctx The context given on signup
   */
  protected createProfile(user: User, ctx?: any): Promise<Partial<Profile>> | Partial<Profile> {
    return { avatar: user?.photoURL, displayName: user?.displayName } as any;
  }

  /** Triggerd when creating or getting a user */
  protected useCollection(user: User): undefined | null | string | Promise<undefined | null | string> {
    return this.path ?? null;
  }

  /** If user connected, return its document in Firestore,  */
  protected getRef(options: { user?: User | null; collection?: string | null } = {}) {
    const user = options.user ?? this.user;
    if (user) {
      return doc(this.db, `${this.path}/${user.uid}`) as DocumentReference<Profile>
    }
    return;
  }

  /** Return current user. Only return when auth has emit */
  awaitUser() {
    return this.user$.pipe(take(1)).toPromise();
  }

  /** Get the current user Profile from Firestore */
  async getValue() {
    const ref = this.getRef();
    if (ref) {
      const snapshot = await getDoc(ref);
      return this.fromFirestore(snapshot);
    }
    return;
  }

  /**
   * @description Delete user from authentication service and database
   * WARNING This is security sensitive operation
   */
  async delete(options: AuthWriteOptions = {}) {
    const user = this.user;
    const ref = this.getRef({ user });
    if (!user || !ref) {
      throw new Error('No user connected');
    }
    const { write = writeBatch(this.db), ctx } = options;
    write.delete(ref);
    if (this.onDelete) await this.onDelete({ write, ctx });
    if (!options.write) {
      await (write as WriteBatch).commit();
    }
    return user.delete();
  }

  /** Update the current profile of the authenticated user */
  async update(
    profile: Partial<Profile> | UpdateCallback<Profile>,
    options: AuthWriteOptions = {}
  ) {
    const ref = this.getRef();
    if (!ref) {
      throw new Error('No user connected.');
    }
    if (isUpdateCallback(profile)) {
      return runTransaction(this.db, async (tx) => {
        const snapshot = (await tx.get(ref)) as DocumentSnapshot<Profile>;
        const doc = this.fromFirestore(snapshot);
        if (!doc) {
          throw new Error(`Could not find document at "${this.path}/${snapshot.id}"`);
        }
        const data = await profile(this.toFirestore(doc, 'update'), tx);
        tx.update(ref, data as UpdateData<Profile>);
        if (this.onUpdate) await this.onUpdate(data, { write: tx, ctx: options.ctx });
        return tx;
      });
    } else if (typeof profile === 'object') {
      const { write = writeBatch(this.db), ctx } = options;
      (write as WriteBatch).update(ref, this.toFirestore(profile, 'update'));
      if (this.onUpdate) await this.onUpdate(profile, { write, ctx });
      // If there is no atomic write provided
      if (!options.write) {
        return (write as WriteBatch).commit();
      }
    }
  }

  /** Manage the creation of the user into Firestore */
  protected async create(cred: UserCredential, options: AuthWriteOptions) {
    const user = cred.user;
    if (!user) {
      throw new Error('Could not create an account');
    }

    const { write = writeBatch(this.db), ctx, collection } = options;
    if (this.onSignup) await this.onSignup(cred, { write, ctx, collection });

    const ref = this.getRef({ user, collection });
    if (ref) {
      const profile = await this.createProfile(user, ctx);
      (write as WriteBatch).set(ref, this.toFirestore(profile, 'add'));
      if (this.onCreate) await this.onCreate(profile, { write, ctx, collection });
      if (!options.write) {
        await (write as WriteBatch).commit();
      }
    }
    return cred;
  }
}







@Injectable({ providedIn: 'root' })
export abstract class FireAuth<Profile, Roles = undefined> extends BaseFireAuth<Profile, Roles> {
  protected abstract path: string | undefined;

  /**
   * Create a user based on email and password
   * Will send a verification email to the user if verificationURL is provided config
   */
  async signup(
    email: string,
    password: string,
    options: AuthWriteOptions = {}
  ): Promise<UserCredential> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    if (this.verificationUrl) {
      const url = this.verificationUrl;
      await sendEmailVerification(cred.user, { url });
    }
    return this.create(cred, options);
  }

  /** Signin with email & password, provider name, provider objet or custom token */
  // tslint:disable-next-line: unified-signatures
  signin(email: string, password: string, options?: AuthWriteOptions): Promise<UserCredential>;
  signin(authProvider: AuthProvider, options?: AuthWriteOptions): Promise<UserCredential>;
  // tslint:disable-next-line: unified-signatures
  signin(token: string, options?: AuthWriteOptions): Promise<UserCredential>;
  async signin(
    provider?: AuthProvider | string,
    passwordOrOptions?: string | AuthWriteOptions,
    options?: AuthWriteOptions
  ): Promise<UserCredential> {
    try {
      let cred: UserCredential;
      if (!provider) {
        cred = await signInAnonymously(this.auth);
      } else if (
        passwordOrOptions &&
        typeof provider === 'string' &&
        typeof passwordOrOptions === 'string'
      ) {
        cred = await signInWithEmailAndPassword(this.auth, provider, passwordOrOptions);
      } else if (typeof provider === 'object') {
        cred = await signInWithPopup(this.auth, provider);
      } else {
        cred = await signInWithCustomToken(this.auth, provider);
      }
      if (!cred.user) {
        throw new Error('Could not find credential for signin');
      }
      
      // Signup: doesn't trigger onSignin
      if (getAdditionalUserInfo(cred)?.isNewUser) {
        options = typeof passwordOrOptions === 'object' ? passwordOrOptions : {};
        return this.create(cred, options);
      }

      if (this.onSignin) await this.onSignin(cred);
      return cred;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        console.warn('You tried to connect with a disabled auth provider. Enable it in Firebase console');
      }
      throw err;
    }
  }

  /** Signs out the current user and clear the store */
  async signout() {
    await signOut(this.auth);
    if (this.onSignout) await this.onSignout();
  }
}