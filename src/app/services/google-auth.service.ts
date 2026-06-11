import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private platformId = inject(PLATFORM_ID);
  
  user = signal<User | null>(null);
  accessToken = signal<string | null>(null);
  isLoggingIn = signal<boolean>(false);
  isInitialized = signal<boolean>(false);

  private auth!: Auth;
  private provider!: GoogleAuthProvider;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const app = initializeApp(firebaseConfig);
        this.auth = getAuth(app);
        
        this.provider = new GoogleAuthProvider();
        this.provider.addScope('https://www.googleapis.com/auth/drive.readonly');
        this.provider.addScope('https://www.googleapis.com/auth/drive.file');

        onAuthStateChanged(this.auth, (user) => {
          this.user.set(user);
          // If we lose login state, we will lose the initial token (we can't persist it).
          // You need to re-login to get the Google access token for Drive APIs.
          if (!user) {
             this.accessToken.set(null);
          }
          this.isInitialized.set(true);
        });
      } catch (e) {
        console.error("Firebase initialization error", e);
        this.isInitialized.set(true);
      }
    } else {
       this.isInitialized.set(true);
    }
  }

  async signIn(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      this.isLoggingIn.set(true);
      const result = await signInWithPopup(this.auth, this.provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        this.accessToken.set(credential.accessToken);
        this.user.set(result.user);
        return credential.accessToken;
      }
      throw new Error('Failed to get access token');
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      this.isLoggingIn.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.auth.signOut();
    this.accessToken.set(null);
    this.user.set(null);
  }
}
