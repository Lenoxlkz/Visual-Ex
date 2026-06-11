const fs = require('fs');
let c = fs.readFileSync('src/app/services/sync.service.ts', 'utf8');

if (!c.includes('ProgressService')) {
  c = c.replace("import { Injectable", "import { ProgressService } from './progress.service';\nimport { Injectable");
  c = c.replace("fileService = inject(FileService);", "fileService = inject(FileService);\n  progressService = inject(ProgressService);");
}

let syncDir = "const descargasId = await this.getOrCreateDescargasFolder(parentId);";
c = c.replace(syncDir, syncDir + "\n     this.progressService.show('Sincronizando...', 100);\n     let scannedFiles = 0;");

let storeFile = "const id = await this.fileService.storeFile(file, formatFolderId);";
c = c.replace(storeFile, "scannedFiles++;\n                             this.progressService.update(scannedFiles, 'Sincronizando ' + file.name + '...');\n                             " + storeFile);

let cleanMiss = "await this.cleanupMissingFiles(descargasId, processedIds);";
c = c.replace(cleanMiss, "this.progressService.hide();\n     " + cleanMiss);

let newFileFallback = "const newFile = new File([file], fileName, { type: file.type });";
c = c.replace(newFileFallback, "currentFileIndex++;\n             this.progressService.update(currentFileIndex, 'Sincronizando ' + file.name + '...');\n             " + newFileFallback);

fs.writeFileSync('src/app/services/sync.service.ts', c);
