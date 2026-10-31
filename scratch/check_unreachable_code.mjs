import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');
const lines = viewsCode.split('\n');

lines.forEach((line, idx) => {
    // Check if line has a return Response, and the following lines have the SAME or GREATER indentation without a new if/def/class/try
    if (/^\s*return\s+Response\(/.test(line)) {
        const indent = line.match(/^(\s*)/)[1].length;
        // check next line
        if (idx + 1 < lines.length) {
            const nextLine = lines[idx + 1];
            const nextIndentMatch = nextLine.match(/^(\s*)/);
            if (nextIndentMatch && nextLine.trim().length > 0) {
                const nextIndent = nextIndentMatch[1].length;
                if (nextIndent >= indent) {
                    console.log(`[POTENTIAL DEAD/INDENTED CODE after line ${idx+1}]`);
                    console.log(`  Line ${idx+1}: ${line}`);
                    console.log(`  Line ${idx+2}: ${nextLine}`);
                    console.log(`  Line ${idx+3}: ${lines[idx+2] || ''}`);
                }
            }
        }
    }
});

