import fs from 'fs';

const modelsCode = fs.readFileSync('backend/api/models.py', 'utf8');
const serializersCode = fs.readFileSync('backend/api/serializers.py', 'utf8');

// Parse model classes and their fields
const modelFields = {};

const modelBlocks = modelsCode.split(/class\s+/);
modelBlocks.forEach(b => {
    const headerMatch = b.match(/^([A-Za-z0-9_]+)\s*\(([^)]*)\):/);
    if (!headerMatch) return;
    const modelName = headerMatch[1];
    const isModel = headerMatch[2].includes('models.Model') || headerMatch[2].includes('AbstractUser');
    if (!isModel) return;

    const fields = new Set(['id', 'pk']);
    const lines = b.split('\n');
    lines.forEach(line => {
        const fieldMatch = line.match(/^\s+([a-zA-Z0-9_]+)\s*=\s*models\./);
        if (fieldMatch) {
            fields.add(fieldMatch[1]);
        }
        const propMatch = line.match(/^\s+def\s+([a-zA-Z0-9_]+)\s*\(self\):/);
        if (propMatch) {
            fields.add(propMatch[1]);
        }
    });
    modelFields[modelName] = fields;
});

console.log('Parsed models:', Object.keys(modelFields));

// Now parse ModelSerializer classes in serializers.py
const serializerBlocks = serializersCode.split(/class\s+/);
let errorsFound = 0;

serializerBlocks.forEach(b => {
    const headerMatch = b.match(/^([A-Za-z0-9_]+)\s*\(([^)]*)\):/);
    if (!headerMatch) return;
    const sName = headerMatch[1];
    const baseClass = headerMatch[2];
    if (!baseClass.includes('ModelSerializer')) return;

    // Find model in Meta
    const metaModelMatch = b.match(/model\s*=\s*([A-Za-z0-9_]+)/);
    if (!metaModelMatch) return;
    const modelName = metaModelMatch[1];

    // Find declared fields in serializer
    const declaredFields = new Set();
    const lines = b.split('\n');
    lines.forEach(line => {
        const dMatch = line.match(/^\s+([a-zA-Z0-9_]+)\s*=\s*serializers\./);
        if (dMatch) {
            declaredFields.add(dMatch[1]);
        }
    });

    // Find fields in Meta
    const fieldsMatch = b.match(/fields\s*=\s*\[([\s\S]*?)\]/);
    if (!fieldsMatch) return;
    const fieldsList = fieldsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);

    const mFields = modelFields[modelName] || new Set();

    fieldsList.forEach(f => {
        if (!mFields.has(f) && !declaredFields.has(f)) {
            console.error(`[FIELD ERROR] Serializer "${sName}" specifies field "${f}" which does NOT exist on model "${modelName}" or serializer!`);
            errorsFound++;
        }
    });
});

console.log(`ModelSerializer verification complete. Errors found: ${errorsFound}`);

