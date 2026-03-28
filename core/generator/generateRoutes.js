function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function generateRoutes(ir) {
  const output = {};

  for (const resource of ir.resources || []) {
    const model = pascalCase(resource.name);

    output[`routes/${resource.name}.routes.js`] = `import express from 'express';\nimport {\n  list${model}s,\n  get${model},\n  create${model},\n  update${model},\n  delete${model}\n} from '../controllers/${resource.name}Controller.js';\n\nconst router = express.Router();\n\nrouter.get('/', list${model}s);\nrouter.get('/:id', get${model});\nrouter.post('/', create${model});\nrouter.put('/:id', update${model});\nrouter.delete('/:id', delete${model});\n\nexport default router;\n`;
  }

  return output;
}

export default generateRoutes;
