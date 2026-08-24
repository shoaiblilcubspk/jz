const fs = require('fs');
const path = require('path');

const files = [
  'src/components/settings/tabs/generalCards.tsx',
  'src/components/settings/tabs/GeneralModules.tsx',
  'src/components/settings/tabs/GeneralSettingsImpl.tsx'
];

for (const relPath of files) {
  const p = path.join('/Users/shoaib/Desktop/pos v12.2', relPath);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    
    // Replace {t("key", "Value")} with {"Value"}
    content = content.replace(/\{t\(\s*['"][^'"]+['"]\s*,\s*(['"][^'"]+['"])\s*\)\}/g, '{$1}');
    
    // Remove the t prop from interfaces
    content = content.replace(/\s*t\s*:\s*Translate\s*;/g, '');
    content = content.replace(/\s*type\s+Translate\s*=\s*\(.*?\)\s*=>\s*string\s*;/g, '');
    
    // Remove the t prop from function destructuring
    content = content.replace(/,\s*t\s*\}/g, '}');
    
    // Remove t={t} from JSX
    content = content.replace(/\s*t=\{t\}/g, '');
    
    // Remove const t = ... from GeneralSettingsImpl
    content = content.replace(/\s*const\s+t\s*=\s*\(.*?\)\s*=>\s*fallback\s*;/g, '');

    fs.writeFileSync(p, content, 'utf8');
    console.log(`Processed ${relPath}`);
  }
}
