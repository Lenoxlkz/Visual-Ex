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
    const token = this.authService.accessToken();
    if (!token) throw new Error('Not authenticated with Google');

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(url, { ...options, headers });
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
    const res = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    if (!res.ok) throw new Error('Error downloading file');
    return await res.blob();
  }

  async uploadFile(file: File | Blob, name: string, parentFolderId?: string): Promise<DriveFile> {
    const metadata: any = { name };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await this.fetchWithAuth('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', {
      method: 'POST',
      body: form
    });
    
    if (!res.ok) throw new Error('Error uploading file');
    return await res.json();
  }
}
