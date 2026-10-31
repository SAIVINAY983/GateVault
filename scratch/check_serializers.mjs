import fs from 'fs';

const serializersCode = fs.readFileSync('backend/api/serializers.py', 'utf8');
const viewsCode = fs.readFileSync('backend/api/views.py', 'utf8');

// Search for any unhandled exceptions or potential syntax / logic bugs
// Let's check all Serializer classes and their declared fields vs Meta.fields
const serializerBlocks = serializersCode.split(/class\s+/);
console.log(`Found ${serializerBlocks.length} serializer blocks.`);

serializerBlocks.forEach(block => {
    const nameMatch = block.match(/^([A-Za-z0-9_]+)\s*\(/);
    if (!nameMatch) return;
    const name = nameMatch[1];
    
    // Check Meta
    const metaMatch = block.match(/class\s+Meta\s*:([\s\S]*?)(?=class|\n\s*def|$)/);
    if (metaMatch) {
        const fieldsMatch = metaMatch[1].match(/fields\s*=\s*(\[[^\]]*\]|'__all__')/);
        if (fieldsMatch) {
            // Check if any field in fields list is duplicated or looks odd
            // console.log(`${name}: fields found`);
        }
    }
});

