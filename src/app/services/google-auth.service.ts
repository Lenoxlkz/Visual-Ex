import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
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
  tokenError = signal<boolean>(false);

  connectionStatus = computed<'green' | 'orange' | 'red' | 'disconnected'>(() => {
    const u = this.user();
    const t = this.accessToken();
    if (!u) return 'disconnected';
    if (!t) return 'red';
    if (this.tokenError()) return 'orange';
    return 'green';
  });

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
        this.provider.setCustomParameters({
          prompt: 'consent',
          access_type: 'offline'
        });

        onAuthStateChanged(this.auth, async (user) => {
          this.user.set(user);
          if (user) {
             // Fetch token from secure server backend using user ID
             try {
                const idToken = await user.getIdToken();
                const res = await fetch('/api/auth/token', {
                   headers: { 'Authorization': `Bearer ${idToken}` }
                });
                if (res.ok) {
                   const data = await res.json();
                   if (data.accessToken) this.accessToken.set(data.accessToken);
                }
             } catch(e) {
                console.error("No se pudo obtener el access token persistido", e);
             }
          } else {
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
        
        // Guardar refresh_token / access_token en backend
        try {
           const idToken = await result.user.getIdToken();
           await fetch('/api/auth/token', {
              method: 'POST',
              headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${idToken}`,
                 'X-User-Id': result.user.uid
              },
              // Firebase Auth no devuelve refreshToken de Google en el cliente por seguridad, 
              // pero enviamos el access_token al backend para persistencia. En entorno real 
              // el backend usaría el código de auth para obtener el refresh_token.
              body: JSON.stringify({ accessToken: credential.accessToken })
           });
        } catch (e) {
           console.error("Error guardando token en backend", e);
        }

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

  async reconnect(): Promise<void> {
    const currentUser = this.user();
    if (!currentUser) return;
    try {
      this.isLoggingIn.set(true);
      console.log('Iniciando reconexión manual (Renovación silenciosa)...');
      const idToken = await currentUser.getIdToken(true); // force refresh firebase token
      const res = await fetch('/api/auth/token', {
         headers: { 
            'Authorization': `Bearer ${idToken}`,
            'X-User-Id': currentUser.uid
         }
      });
      if (res.ok) {
         const data = await res.json();
         if (data.accessToken) {
            this.accessToken.set(data.accessToken);
            this.tokenError.set(false);
            console.log('Reconexión exitosa. Nuevo token de acceso obtenido.');
         } else {
            this.tokenError.set(true);
         }
      } else {
         console.warn('Reconexión fallida: el backend no devolvió un token válido.');
         this.tokenError.set(true);
      }
    } catch (e) {
      console.error('Error durante la reconexión manual:', e);
      this.tokenError.set(true);
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
