import fs from 'fs';

function checkBrackets(filename) {
    const code = fs.readFileSync(filename, 'utf8');
    const lines = code.split('\n');
    const stack = [];
    let inString = false;
    let strChar = null;
    let isTriple = false;

    console.log(`Checking bracket balance for ${filename}...`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let j = 0;
        while (j < line.length) {
            // Check triple quotes
            if (!inString && (line.slice(j, j + 3) === '"""' || line.slice(j, j + 3) === "'''")) {
                inString = true;
                strChar = line.slice(j, j + 3);
                isTriple = true;
                j += 3;
                continue;
            } else if (inString && isTriple && line.slice(j, j + 3) === strChar) {
                inString = false;
                isTriple = false;
                strChar = null;
                j += 3;
                continue;
            } else if (!inString && (line[j] === '"' || line[j] === "'")) {
                inString = true;
                strChar = line[j];
                isTriple = false;
                j++;
                continue;
            } else if (inString && !isTriple && line[j] === strChar && line[j - 1] !== '\\') {
                inString = false;
                strChar = null;
                j++;
                continue;
            }

            if (inString) {
                j++;
                continue;
            }

            if (line[j] === '#') {
                break; // Comment till end of line
            }

            const char = line[j];
            if (char === '(' || char === '[' || char === '{') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === ')' || char === ']' || char === '}') {
                if (stack.length === 0) {
                    console.error(`[SYNTAX ERROR in ${filename}] Unmatched closing '${char}' at line ${i + 1}, col ${j + 1}`);
                } else {
                    const top = stack.pop();
                    const expected = top.char === '(' ? ')' : top.char === '[' ? ']' : '}';
                    if (char !== expected) {
                        console.error(`[SYNTAX ERROR in ${filename}] Mismatched bracket '${char}' at line ${i + 1}, col ${j + 1} (expected '${expected}' opened at line ${top.line})`);
                    }
                }
            }
            j++;
        }
    }

    if (stack.length > 0) {
        stack.forEach(unclosed => {
            console.error(`[SYNTAX ERROR in ${filename}] Unclosed '${unclosed.char}' opened at line ${unclosed.line}`);
        });
    } else {
        console.log(`[OK] All brackets perfectly balanced in ${filename}`);
    }
}

checkBrackets('backend/api/views.py');
checkBrackets('backend/api/serializers.py');
checkBrackets('backend/api/models.py');
checkBrackets('backend/api/urls.py');
checkBrackets('backend/backend/settings.py');
checkBrackets('backend/backend/urls.py');

