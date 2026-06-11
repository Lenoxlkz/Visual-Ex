import { ProgressService } from './progress.service';
import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FileService } from './file.service';

export type SyncInterval = 'off' | '6h' | '12h' | '24h' | '32h' | '48h' | '7d' | '15d' | '30d' | '60d' | '90d';

@Injectable({ providedIn: 'root' })
export class SyncService {
  fileService = inject(FileService);
  progressService = inject(ProgressService);

  syncIntervals: SyncInterval[] = ['off', '6h', '12h', '24h', '32h', '48h', '7d', '15d', '30d', '60d', '90d'];
  individualIntervalIndex = signal<number>(0);
  totalIntervalIndex = signal<number>(0);

  isLoading = signal<boolean>(false);
  isMobileEnv = signal<boolean>(false);
  private syncTimer: any;
  private currentHandle: any = null;
  private currentMode: 'individual' | 'total' | null = null;

  needsPermission = signal<boolean>(false);
  
  // Expose an event or signal to trigger sync UI opening
  triggerSyncUI = signal<number>(0);
  private platformId = inject(PLATFORM_ID);

  constructor() {
     if (isPlatformBrowser(this.platformId)) {
       this.checkEnvironment();
       this.loadSettings();

       // Expose a callback for the Android bridge to notify us when sync is complete
       (window as any).onNativeSyncComplete = () => {
           console.log("Native sync completed.");
           this.isLoading.set(false);
       };
     }
  }

  private checkEnvironment() {
     const isAndroid = /Android/i.test(navigator.userAgent);
     const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
     const hasDirectoryPicker = ('showDirectoryPicker' in window);
     
     if (isAndroid || isIOS || !hasDirectoryPicker) {
         this.isMobileEnv.set(true);
     }
  }

  async requestSyncPermission() {
      if (!this.currentHandle) return;
      try {
          if (this.currentHandle.requestPermission) {
              const permission = await this.currentHandle.requestPermission({ mode: 'read' });
              if (permission === 'granted') {
                  this.needsPermission.set(false);
                  this.runPeriodicSync();
              }
          }
      } catch (e) {
          console.error(e);
      }
  }

  private async loadSettings() {
      const db = await (this.fileService as any).dbPromise;
      if (!db) return; // Wait for initializations
      const sIndividual = await db.get('sync-settings', 'individualInterval');
      if (sIndividual !== undefined) this.individualIntervalIndex.set(sIndividual);
      
      const sTotal = await db.get('sync-settings', 'totalInterval');
      if (sTotal !== undefined) this.totalIntervalIndex.set(sTotal);

      this.currentHandle = await db.get('sync-settings', 'directoryHandle');
      this.currentMode = await db.get('sync-settings', 'syncMode');

      if (this.currentHandle && this.currentHandle !== 'fallback_individual' && this.currentHandle !== 'fallback_total' && this.currentHandle.queryPermission) {
          const permission = await this.currentHandle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
             this.needsPermission.set(true);
          }
      }

      this.setupPeriodicTimer();
  }

  private async saveSettings() {
      const db = await (this.fileService as any).dbPromise;
      if (!db) return;
      await db.put('sync-settings', this.individualIntervalIndex(), 'individualInterval');
      await db.put('sync-settings', this.totalIntervalIndex(), 'totalInterval');
      if (this.currentHandle) await db.put('sync-settings', this.currentHandle, 'directoryHandle');
      if (this.currentMode) await db.put('sync-settings', this.currentMode, 'syncMode');
  }

  private setupPeriodicTimer() {
     if (this.syncTimer) clearInterval(this.syncTimer);

     let activeInterval = 0;
     if (this.individualIntervalIndex() > 0) {
        activeInterval = this.getMsFromInterval(this.syncIntervals[this.individualIntervalIndex()]);
     } else if (this.totalIntervalIndex() > 0) {
        activeInterval = this.getMsFromInterval(this.syncIntervals[this.totalIntervalIndex()]);
     }

     if (activeInterval > 0) {
         this.syncTimer = setInterval(() => {
             this.runPeriodicSync();
         }, activeInterval);
     }
  }

  async runPeriodicSync() {
      if (!this.currentHandle || this.currentHandle === 'fallback_individual' || this.currentHandle === 'fallback_total') return;
      if (this.isLoading()) return;

      try {
          this.isLoading.set(true);
          // Verify permission, if denied ask again (requires user interaction though, might fail periodically if permission dropped)
          if (this.currentHandle.queryPermission) {
              const permission = await this.currentHandle.queryPermission({ mode: 'read' });
              if (permission === 'granted') {
                 this.needsPermission.set(false);
                 await this.syncDirectoryToLibrary(this.currentHandle, 'root');
              } else {
                 this.needsPermission.set(true);
                 console.warn("Permission to file system was revoked or dropped.");
              }
          } else {
             // In browser that doesn't support queryPermission, just try to sync
             await this.syncDirectoryToLibrary(this.currentHandle, 'root');
          }
      } catch (e) {
          console.error("Periodic sync failed", e);
      } finally {
          this.progressService.hide();
          this.isLoading.set(false);
      }
  }

  private getMsFromInterval(val: SyncInterval): number {
    switch (val) {
      case '6h': return 6 * 60 * 60 * 1000;
      case '12h': return 12 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '32h': return 32 * 60 * 60 * 1000;
      case '48h': return 48 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '15d': return 15 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      case '60d': return 60 * 24 * 60 * 60 * 1000;
      case '90d': return 90 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  private async selectDirectoryFallback(): Promise<File[]> {
      return new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true;
          (input as any).directory = true;
          input.multiple = true;
          input.accept = '.epub,.pdf,.docx,.doc,.cbz,.cbr,.rar,.zip,.png,.jpg,.jpeg';
          
          input.onchange = (e: any) => {
              const files = e.target.files;
              if (!files || files.length === 0) {
                  reject(new DOMException('No files selected', 'AbortError'));
                  return;
              }
              resolve(Array.from(files));
          };
          input.onerror = (e) => reject(e);
          
          document.body.appendChild(input);
          setTimeout(() => {
              input.click();
              document.body.removeChild(input);
          }, 0);
      });
  }

  private async requestPersistentStorage() {
      if (navigator.storage && navigator.storage.persist) {
          try {
              await navigator.storage.persist();
          } catch(e) {
              // Ignore if not supported / rejected
          }
      }
  }

  async startIndividualSync() {
    if (this.totalIntervalIndex() > 0) return; 

    try {
      if ((window as any).AndroidSyncBridge) {
          this.isLoading.set(true);
          (window as any).AndroidSyncBridge.startSync('individual');
          return;
      }

      await this.requestPersistentStorage();

      let filesFromFallback: File[] | null = null;
      let directoryHandle: any = null;

      if (!('showDirectoryPicker' in window)) {
          filesFromFallback = await this.selectDirectoryFallback();
      } else {
          try {
             directoryHandle = await (window as any).showDirectoryPicker({ id: 'individual-sync' });
          } catch(e: any) {
             if (e.name === 'SecurityError' || e.name === 'TypeError') {
                 filesFromFallback = await this.selectDirectoryFallback();
             } else {
                 throw e; // rethrow to be caught by outer catch
             }
          }
      }

      this.isLoading.set(true);
      
      if (filesFromFallback) {
          this.currentHandle = 'fallback_individual';
          this.currentMode = 'individual';
          await this.saveSettings();
          await this.syncFallbackFilesToLibrary(filesFromFallback, 'root');
      } else if (directoryHandle) {
          this.currentHandle = directoryHandle;
          this.currentMode = 'individual';
          await this.saveSettings();
          await this.syncDirectoryToLibrary(directoryHandle, 'root');
      }
    } catch(e: any) {
      console.error(e);
      if (e.name !== 'AbortError') {
          alert('Error al iniciar sincronización: ' + e.message);
      }
    } finally {
      this.progressService.hide();
      this.isLoading.set(false);
    }
  }

  async startTotalSync() {
    if (this.individualIntervalIndex() > 0) return; 

    try {
      if ((window as any).AndroidSyncBridge) {
          this.isLoading.set(true);
          (window as any).AndroidSyncBridge.startSync('total');
          return;
      }

      await this.requestPersistentStorage();

      let filesFromFallback: File[] | null = null;
      let directoryHandle: any = null;

      if (!('showDirectoryPicker' in window)) {
          filesFromFallback = await this.selectDirectoryFallback();
      } else {
          try {
             directoryHandle = await (window as any).showDirectoryPicker({ id: 'total-sync' });
          } catch(e: any) {
             if (e.name === 'SecurityError' || e.name === 'TypeError') {
                 filesFromFallback = await this.selectDirectoryFallback();
             } else {
                 throw e;
             }
          }
      }

      this.isLoading.set(true);

      if (filesFromFallback) {
          this.currentHandle = 'fallback_total';
          this.currentMode = 'total';
          await this.saveSettings();
          await this.syncFallbackFilesToLibrary(filesFromFallback, 'root');
      } else if (directoryHandle) {
          this.currentHandle = directoryHandle;
          this.currentMode = 'total';
          await this.saveSettings();
          await this.syncDirectoryToLibrary(directoryHandle, 'root');
      }
    } catch(e: any) {
      console.error(e);
      if (e.name !== 'AbortError') {
          alert('Error al iniciar sincronización: ' + e.message);
      }
    } finally {
      this.progressService.hide();
      this.isLoading.set(false);
    }
  }

  async cycleIndividualInterval() {
    if (this.totalIntervalIndex() > 0) return; 
    
    this.individualIntervalIndex.update(i => (i + 1) % this.syncIntervals.length);
    this.saveSettings();
    this.setupPeriodicTimer();
  }

  async cycleTotalInterval() {
    if (this.individualIntervalIndex() > 0) return; 

    this.totalIntervalIndex.update(i => (i + 1) % this.syncIntervals.length);
    this.saveSettings();
    this.setupPeriodicTimer();
  }

  private async getOrCreateDescargasFolder(rootParentId: string): Promise<string> {
      const children = await this.fileService.getFilesByParent(rootParentId);
      let descargas = children.find(f => f.type === 'folder' && f.name === 'Descargas');
      if (!descargas) {
          return await this.fileService.createFolder('Descargas', rootParentId);
      }
      return descargas.id;
  }

  private async getOrCreateFormatFolder(descargasId: string, formatName: string): Promise<string> {
      const children = await this.fileService.getFilesByParent(descargasId);
      let folder = children.find(f => f.type === 'folder' && f.name === formatName);
      if (!folder) {
          return await this.fileService.createFolder(formatName, descargasId);
      }
      return folder.id;
  }

  private getFormatFolderName(extension: string): string {
      switch(extension) {
          case 'docx': case 'doc': return 'Word';
          case 'pdf': return 'PDFs';
          case 'epub': return 'ePubs';
          case 'cbz': case 'cbr': return 'Comics';
          case 'rar': return 'RAR';
          case 'zip': return 'ZIP';
          case 'png': return 'PNG';
          case 'jpg': case 'jpeg': return 'JPG';
          default: return 'Otros';
      }
  }

  private async syncDirectoryToLibrary(directoryHandle: any, parentId: string) {
     const descargasId = await this.getOrCreateDescargasFolder(parentId);
     this.progressService.show('Sincronizando directorio...', 100);
     let scannedFiles = 0;
     const processedIds = new Set<string>();
     const formatSubfolders = new Map<string, string>();
     processedIds.add(descargasId);

     const processDirectory = async (handle: any) => {
         for await (const entry of handle.values()) {
             if (entry.kind === 'file') {
                 try {
                     const file = await entry.getFile();
                     const extension = file.name.split('.').pop()?.toLowerCase();
                     const supportedExtensions = ['epub', 'pdf', 'docx', 'doc', 'cbz', 'cbr', 'rar', 'zip', 'png', 'jpg', 'jpeg'];
                     if (extension && supportedExtensions.includes(extension)) {
                         const formatName = this.getFormatFolderName(extension);
                         let formatFolderId = formatSubfolders.get(formatName);
                         if (!formatFolderId) {
                             formatFolderId = await this.getOrCreateFormatFolder(descargasId, formatName);
                             formatSubfolders.set(formatName, formatFolderId);
                             processedIds.add(formatFolderId);
                         }

                         const currentDbFiles = await this.fileService.getFilesByParent(formatFolderId);
                         const existingItem = currentDbFiles.find(f => f.name === file.name && f.type === 'file');
                         
                         if (!existingItem) {
                             scannedFiles++;
                             this.progressService.update(scannedFiles, 'Sincronizando ' + file.name + '...');
                             const id = await this.fileService.storeFile(file, formatFolderId);
                             processedIds.add(id);
                         } else if (existingItem.size !== file.size || existingItem.lastModified !== file.lastModified) {
                             await this.fileService.deleteItem(existingItem.id);
                             const id = await this.fileService.storeFile(file, formatFolderId);
                             processedIds.add(id);
                         } else {
                             processedIds.add(existingItem.id);
                         }
                     }
                 } catch(e) {
                     console.error('Failed to sync file', entry.name, e);
                 }
             } else if (entry.kind === 'directory') {
                 if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'windows' || entry.name.toLowerCase() === 'system32' || entry.name.toLowerCase() === 'node_modules') continue;
                 await processDirectory(entry);
             }
         }
     };

     await processDirectory(directoryHandle);
     this.progressService.hide();
     await this.cleanupMissingFiles(descargasId, processedIds);
     this.progressService.hide();
  }

  private async cleanupMissingFiles(folderId: string, processedIds: Set<string>) {
      const children = await this.fileService.getFilesByParent(folderId);
      for (const child of children) {
          if (!processedIds.has(child.id)) {
              await this.fileService.deleteItem(child.id);
          } else if (child.type === 'folder') {
              await this.cleanupMissingFiles(child.id, processedIds);
          }
      }
  }

  private async syncFallbackFilesToLibrary(files: File[], rootParentId: string) {
     const descargasId = await this.getOrCreateDescargasFolder(rootParentId);
     this.progressService.show('Sincronizando archivos...', files.length);
     let currentFileIndex = 0;
     const processedIds = new Set<string>();
     const formatSubfolders = new Map<string, string>();
     processedIds.add(descargasId);

     for (const file of files) {
         const pathParts = (file.webkitRelativePath || file.name).split('/');
         const fileName = pathParts.pop()!;
         
         if (fileName.startsWith('.') || pathParts.some(p => p.startsWith('.') || p.toLowerCase() === 'windows' || p.toLowerCase() === 'system32' || p.toLowerCase() === 'node_modules')) {
             continue;
         }

         const extension = fileName.split('.').pop()?.toLowerCase();
         const supportedExtensions = ['epub', 'pdf', 'docx', 'doc', 'cbz', 'cbr', 'rar', 'zip', 'png', 'jpg', 'jpeg'];
         if (!extension || !supportedExtensions.includes(extension)) continue;

         const formatName = this.getFormatFolderName(extension);
         let formatFolderId = formatSubfolders.get(formatName);
         if (!formatFolderId) {
             formatFolderId = await this.getOrCreateFormatFolder(descargasId, formatName);
             formatSubfolders.set(formatName, formatFolderId);
             processedIds.add(formatFolderId);
         }

         const finalChildren = await this.fileService.getFilesByParent(formatFolderId);
         const existingFile = finalChildren.find(f => f.type === 'file' && f.name === fileName);

         if (!existingFile) {
             currentFileIndex++;
             this.progressService.update(currentFileIndex, 'Sincronizando ' + file.name + '...');
             const newFile = new File([file], fileName, { type: file.type });
             const id = await this.fileService.storeFile(newFile, formatFolderId);
             processedIds.add(id);
         } else if (existingFile.size !== file.size) {
             await this.fileService.deleteItem(existingFile.id);
             const newFile = new File([file], fileName, { type: file.type });
             const id = await this.fileService.storeFile(newFile, formatFolderId);
             processedIds.add(id);
         } else {
             processedIds.add(existingFile.id);
         }
     }
     await this.cleanupMissingFiles(descargasId, processedIds);
     this.progressService.hide();
  }
}
