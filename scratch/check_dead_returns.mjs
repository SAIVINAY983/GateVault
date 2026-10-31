import fs from 'fs';

const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');
const lines = viewsCode.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line contains a standalone return Response statement that ends with ) or );
    if (/^\s*return\s+Response\([^)]*\)\s*$/.test(line)) {
        const indent = line.match(/^(\s*)/)[1].length;
        // look ahead
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length) {
            const nextLine = lines[j];
            const nextIndent = nextLine.match(/^(\s*)/)[1].length;
            if (nextIndent >= indent && !nextLine.trim().startsWith('def ') && !nextLine.trim().startsWith('class ') && !nextLine.trim().startsWith('@') && !nextLine.trim().startsWith('#')) {
                console.log(`\nPotential dead code after return at line ${i+1}:`);
                console.log(`  Line ${i+1}: ${line}`);
                console.log(`  Line ${j+1}: ${nextLine}`);
                for (let k = j + 1; k < Math.min(lines.length, j + 5); k++) {
                    console.log(`  Line ${k+1}: ${lines[k]}`);
                }
            }
        }
    }
}

