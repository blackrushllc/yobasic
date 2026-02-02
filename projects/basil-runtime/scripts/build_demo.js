import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildDemo() {
  const zip = new JSZip();
  const demoDir = path.resolve(__dirname, '../demo_packages/hello_basil');
  
  function addFiles(dir, zipFolder) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        addFiles(filePath, zipFolder.folder(file));
      } else {
        zipFolder.file(file, fs.readFileSync(filePath));
      }
    }
  }

  addFiles(demoDir, zip);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  const outputPath = path.resolve(__dirname, '../public/hello_basil.bpkg');
  
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
  console.log('Built demo_packages/hello_basil.bpkg to public/');
}

buildDemo().catch(console.error);
