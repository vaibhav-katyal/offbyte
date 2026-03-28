import fs from 'fs';
import path from 'path';

export function writeOutputFiles(baseDir, filesMap = {}) {
  for (const [relativePath, content] of Object.entries(filesMap)) {
    const fullPath = path.join(baseDir, relativePath);
    const fullDir = path.dirname(fullPath);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
  }
}

export default writeOutputFiles;
