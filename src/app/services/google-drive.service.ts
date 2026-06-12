import { Injectable, inject } from '@angular/core';
import { GoogleAuthService } from './google-auth.service';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private authService = inject(GoogleAuthService);

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let token = this.authService.accessToken();
    if (!token) throw new Error('Not authenticated with Google');

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept-Encoding')) {
       headers.set('Accept-Encoding', 'gzip');
    }

    let response = await fetch(url, { ...options, headers });
    
    // 3. Renovación automática: Gestionar expiración de tokens
    if (response.status === 401) {
       console.log("Access token expiro, solicitando nuevo token...");
       const user = this.authService.user();
       if (user) {
          try {
             const idToken = await user.getIdToken();
             const tokenRes = await fetch('/api/auth/token', {
                headers: { 'Authorization': `Bearer ${idToken}` }
             });
             if (tokenRes.ok) {
                const data = await tokenRes.json();
                if (data.accessToken) {
                   this.authService.accessToken.set(data.accessToken);
                   this.authService.tokenError.set(false);
                   token = data.accessToken;
                   headers.set('Authorization', `Bearer ${token}`);
                   response = await fetch(url, { ...options, headers }); // Reintentar la petición
                } else {
                   this.authService.tokenError.set(true);
                }
             } else {
                this.authService.tokenError.set(true);
             }
          } catch (e) {
             console.error("Error durante renovación de token", e);
             this.authService.tokenError.set(true);
          }
       } else {
          this.authService.tokenError.set(true);
       }
    }
    
    return response;
  }

  async getOrCreateBackupFolder(folderName: string = 'Respaldos de Visual-Ex'): Promise<string> {
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
    const res = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
    if (!res.ok) throw new Error('Error finding folder');
    const data = await res.json();
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create the folder
    const createRes = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    
    if (!createRes.ok) throw new Error('Error creating folder');
    const newData = await createRes.json();
    return newData.id;
  }

  async listFiles(folderId?: string): Promise<DriveFile[]> {
    let query = 'trashed=false and mimeType != "application/vnd.google-apps.folder"';
    if (folderId) {
       query += ` and '${folderId}' in parents`;
    }

    // Filter only compatible extensions or mimeTypes? The simplest is relying on app filtering after getting the list,
    // or query specific mime types. Google Drive API `q` doesn't support easily querying many extensions in a simple OR, 
    // but we can query by mimeType. Or just get all files in the folder and filter them locally.
    
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)&pageSize=1000`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Error listing files');
    const data = await res.json();
    return data.files || [];
  }

  async downloadFile(fileId: string): Promise<Blob> {
    // 2. COMPRESIÓN GZIP HABILITADA: explícitamente solicitar gzip para disminuir tiempos!
    const res = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
       headers: { 'Accept-Encoding': 'gzip' }
    });
    if (!res.ok) throw new Error('Error downloading file');
    return await res.blob();
  }

  async uploadFile(file: File | Blob, name: string, parentFolderId?: string): Promise<DriveFile> {
    const metadata: any = { name };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }
    const token = this.authService.accessToken();
    if (!token) throw new Error('Not authenticated');

    const mimeType = file.type || 'application/octet-stream';
    
    // 1. CARGA REANUDABLE POR BLOQUES Y COMPRESIÓN GZIP
    const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': file.size.toString(),
        // Para subir comprimido necesitaríamos comprimir el buffer y pasarlo.
        // Habilitamos Accept-Encoding gzip como buena práctica
        'Accept-Encoding': 'gzip'
      },
      body: JSON.stringify(metadata)
    });

    if (!initRes.ok) throw new Error('Resumable upload initialization failed');
    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('No upload URL returned');

    // Optimizando 1. Carga Reanudable por Bloques (chunkSize incrementado)
    const chunkSize = 5 * 1024 * 1024; // 5MB (multiplo de 256KB recomendado)
    let start = 0;
    let end = Math.min(chunkSize, file.size);
    let lastResponse: Response | null = null;
    
    // Fallback for 0-byte files
    if (file.size === 0) {
       lastResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes */0` }
       });
       return await lastResponse.json();
    }

    let retryCount = 0;
    while (start < file.size) {
      const chunk = file.slice(start, end);
      lastResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.size.toString(),
          'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
        },
        body: chunk
      });
      
      if (lastResponse.status === 308) {
         // Incomplete, continue
         start = end;
         end = Math.min(start + chunkSize, file.size);
         retryCount = 0;
      } else if (lastResponse.ok || lastResponse.status === 200 || lastResponse.status === 201) {
         // Finished completely
         break;
      } else {
         if (retryCount < 3) {
             // We can check the active range by querying the uploadUrl with an empty PUT
             // but for simplicity, we just retry the same chunk.
             retryCount++;
             await new Promise(r => setTimeout(r, 1000 * retryCount));
         } else {
             throw new Error('Upload chunk failed after retries');
         }
      }
    }

    if (!lastResponse) throw new Error('Upload failed unpredictably');
    return await lastResponse.json();
  }
}
