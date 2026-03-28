function mapFieldToMongoose(field) {
  if (field.type === 'ObjectId') {
    return `${field.name}: { type: mongoose.Schema.Types.ObjectId${field.ref ? `, ref: '${field.ref}'` : ''}${field.required ? ', required: true' : ''} }`;
  }
  return `${field.name}: { type: ${field.type}${field.required ? ', required: true' : ''} }`;
}

function modelName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function generateModels(ir) {
  const output = {};

  for (const resource of ir.resources || []) {
    const schemaFields = (resource.fields || []).map(mapFieldToMongoose).join(',\n  ');
    const className = modelName(resource.name);

    output[`models/${className}.js`] = `import mongoose from 'mongoose';\n\nconst ${resource.name}Schema = new mongoose.Schema({\n  ${schemaFields}\n}, { timestamps: true });\n\nexport default mongoose.model('${className}', ${resource.name}Schema);\n`;
  }

  return output;
}

export default generateModels;
