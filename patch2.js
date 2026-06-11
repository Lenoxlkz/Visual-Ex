const fs = require('fs');
let c = fs.readFileSync('src/app/services/sync.service.ts', 'utf8');

c = c.replace(/import \{ Injectable, inject, signal, PLATFORM_ID \}/, 'import { ProgressService } from "./progress.service";
import { Injectable, inject, signal, PLATFORM_ID }');

c = c.replace('fileService = inject(FileService);', 'fileService = inject(FileService);
  progressService = inject(ProgressService);');

c = c.replace('const processDirectory = async (handle: any) => {',
  'this.progressService.show("Sincronizando...", 100);
     let scannedFiles = 0;
     const processDirectory = async (handle: any) => {');

c = c.replace('await processDirectory(directoryHandle);',
  'await processDirectory(directoryHandle);');

c = c.replace('const descargasId = await this.getOrCreateDescargasFolder(rootParentId);',
  'const descargasId = await this.getOrCreateDescargasFolder(rootParentId);
     if (!c.includes("Sincronizando archivos...")) this.progressService.show("Sincronizando archivos...", files ? files.length : 100);
     let currentFileIndex = 0;');

fs.writeFileSync('src/app/services/sync.service.ts', c);