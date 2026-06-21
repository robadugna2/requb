const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// 1. Rename Badge.tsx to StatusBadge.tsx
const oldBadgePath = path.join(srcDir, 'components', 'ui', 'Badge.tsx');
const newBadgePath = path.join(srcDir, 'components', 'ui', 'StatusBadge.tsx');

if (fs.existsSync(oldBadgePath) && !fs.existsSync(newBadgePath)) {
    // Only rename if Badge.tsx actually contains the custom logic (has 'statusConfig')
    const content = fs.readFileSync(oldBadgePath, 'utf8');
    if (content.includes('statusConfig')) {
        // Also replace the export default function Badge with StatusBadge
        const newContent = content.replace(/export default function Badge/g, 'export default function StatusBadge');
        fs.writeFileSync(newBadgePath, newContent);
        fs.unlinkSync(oldBadgePath);
        console.log('Renamed Badge.tsx to StatusBadge.tsx');
    }
}

// 2. Fix imports in all .tsx files
function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            // Fix Button imports
            if (content.includes("import Button from '@/components/ui/Button'")) {
                content = content.replace(/import Button from '@\/components\/ui\/Button';?/g, "import { Button } from '@/components/ui/button';");
                changed = true;
            }

            // Fix Badge imports
            if (content.includes("import Badge from '@/components/ui/Badge'")) {
                content = content.replace(/import Badge from '@\/components\/ui\/Badge';?/g, "import StatusBadge from '@/components/ui/StatusBadge';");
                // Replace <Badge to <StatusBadge for old badge component
                content = content.replace(/<Badge\s/g, "<StatusBadge ");
                content = content.replace(/<\/Badge>/g, "</StatusBadge>");
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated imports in ${fullPath}`);
            }
        }
    }
}

processDir(srcDir);
console.log('Done fixing imports.');
