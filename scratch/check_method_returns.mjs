import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');
const lines = viewsCode.split('\n');

// Check all 'def post', 'def get', etc.
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const mMatch = l.match(/^\s+def\s+(post|get|put|patch|delete)\s*\(\s*self\s*,\s*request([^)]*)\):/);
    if (mMatch) {
        const methodName = mMatch[1];
        const indent = l.match(/^(\s*)/)[1].length;
        
        // collect method body
        let j = i + 1;
        const methodLines = [];
        while (j < lines.length) {
            const nextLine = lines[j];
            if (nextLine.trim().length > 0) {
                const nextIndent = nextLine.match(/^(\s*)/)[1].length;
                if (nextIndent <= indent) {
                    break;
                }
            }
            methodLines.push({ text: nextLine, lineNum: j + 1 });
            j++;
        }

        // Check if there is at least one return Response
        const hasReturnResponse = methodLines.some(ml => ml.text.includes('return Response'));
        if (!hasReturnResponse) {
            console.warn(`[WARNING] Method ${methodName} at line ${i+1} has NO 'return Response'!`);
        }
    }
}
console.log('Method check complete.');

