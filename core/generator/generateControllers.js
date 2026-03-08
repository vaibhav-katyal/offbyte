function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function generateControllers(ir) {
  const output = {};

  for (const resource of ir.resources || []) {
    const model = pascalCase(resource.name);

    output[`controllers/${resource.name}Controller.js`] = `import ${model} from '../models/${model}.js';\n\nexport const list${model}s = async (req, res) => {\n  const data = await ${model}.find();\n  res.json({ success: true, data });\n};\n\nexport const get${model} = async (req, res) => {\n  const data = await ${model}.findById(req.params.id);\n  res.json({ success: true, data });\n};\n\nexport const create${model} = async (req, res) => {\n  const data = await ${model}.create(req.body);\n  res.status(201).json({ success: true, data });\n};\n\nexport const update${model} = async (req, res) => {\n  const data = await ${model}.findByIdAndUpdate(req.params.id, req.body, { new: true });\n  res.json({ success: true, data });\n};\n\nexport const delete${model} = async (req, res) => {\n  await ${model}.findByIdAndDelete(req.params.id);\n  res.json({ success: true });\n};\n`;
  }

  return output;
}

export default generateControllers;
