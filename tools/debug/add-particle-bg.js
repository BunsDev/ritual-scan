const fs = require('fs');
const path = require('path');

// List of all page files to update
const pageFiles = [
  'src/app/analytics/page.tsx',
  'src/app/async/page.tsx', 
  'src/app/blocks/page.tsx',
  'src/app/debug-contracts/page.tsx',
  'src/app/mempool/page.tsx',
  'src/app/ritual-analytics/page.tsx',
  'src/app/scheduled/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/transactions/page.tsx',
  'src/app/address/[address]/page.tsx',
  'src/app/block/[blockNumber]/page.tsx',
  'src/app/token/[address]/page.tsx',
  'src/app/tx/[txHash]/page.tsx'
];

pageFiles.forEach(filePath => {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${filePath} - file doesn't exist`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Skip if already has particle background
    if (content.includes('useParticleBackground')) {
      console.log(`✅ ${filePath} - already has particle background`);
      return;
    }

    // Add import at the top (after existing imports)
    const importStatement = "import { useParticleBackground } from '@/hooks/useParticleBackground'";
    
    // Find the last import statement
    const importLines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].trim().startsWith('import ') && !importLines[i].includes('//')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      importLines.splice(lastImportIndex + 1, 0, importStatement);
      content = importLines.join('\n');
    } else {
      // Fallback: add at the beginning
      content = importStatement + '\n' + content;
    }

    // Add hook call at the beginning of the component function
    // Find the component function (export default function...)
    const funcMatch = content.match(/(export default function \w+\([^)]*\) \{)/);
    if (funcMatch) {
      const replacement = funcMatch[1] + '\n  useParticleBackground()';
      content = content.replace(funcMatch[1], replacement);
    }

    // Write back to file
    fs.writeFileSync(fullPath, content);
    console.log(`🎨 ${filePath} - added particle background`);

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('\n🎉 Particle background setup complete!');
console.log('All pages now have the WebGL particle background effect.');
