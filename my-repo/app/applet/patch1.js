const fs = require('fs');
let c = fs.readFileSync('src/app/components/library/library.component.ts', 'utf8');

c = c.replace('const files = Array.from(input.files);',
`const files = Array.from(input.files);
     this.progressService.show('Subiendo archivos...', files.length);
     let currentFileIndex = 0;`);

c = c.replace('await this.fileService.storeFile(file, currentFolder);',
`await this.fileService.storeFile(file, currentFolder);
           currentFileIndex++;
           this.progressService.update(currentFileIndex, 'Subiendo ' + file.name + '...');`);

c = c.replace('await this.fileService.storeFile(file, baseParentId);',
`await this.fileService.storeFile(file, baseParentId);
           currentFileIndex++;
           this.progressService.update(currentFileIndex, 'Subiendo ' + file.name + '...');`);

c = c.replace("input.value = ''; // reset",
`input.value = ''; // reset
     this.progressService.hide();`);

fs.writeFileSync('src/app/components/library/library.component.ts', c);
