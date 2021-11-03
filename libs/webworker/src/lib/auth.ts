import { Auth, signInWithEmailAndPassword, useDeviceLanguage } from 'firebase/auth';
import { getAuth, useAuthEmulator } from 'firebase/auth';
import { getApp } from './app';

interface AuthConfig {
  useEmulator?: ReturnType<typeof _useAuthEmulator>;
  useDeviceLanguage?: typeof useDeviceLanguage;
}

let _auth: Auth;
let _config: AuthConfig;

async function _getAuth() {
  if (!_auth) {
    const options = _config || {};
    const app = await getApp();
    const auth = getAuth(app);
    // Should be just after getFirestore
    if (options.useEmulator) {
      options.useEmulator(auth)
    }
    _auth = auth;
  }
  return _auth;
}

function _useAuthEmulator(url: string, options?: Parameters<typeof useAuthEmulator>[2]) {
  return (auth: Auth) => useAuthEmulator(auth, url);
}


export const useAuth = (options: Partial<AuthConfig> = {}) => {
  _config = options;
  return {
    signin: signInWithEmailAndPassword,
  }
};

export type AuthApi = ReturnType<typeof useAuth>;

export {
  _useAuthEmulator as useAuthEmulator
};