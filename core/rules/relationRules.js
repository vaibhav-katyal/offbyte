function normalizeResourceName(name) {
  return name.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
}

function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function applyRelationRules(ir) {
  const resources = ir.resources || [];
  const resourceNames = new Set(resources.map((r) => normalizeResourceName(r.name)));
  const relationSet = new Set();
  const relations = [...(ir.relations || [])];

  for (const resource of resources) {
    for (const field of resource.fields || []) {
      const match = field.name.match(/^(\w+)Id$/i);
      if (!match) continue;

      const target = normalizeResourceName(match[1]);
      if (!resourceNames.has(target)) continue;

      field.type = 'ObjectId';
      field.ref = pascalCase(target);

      const key = `${resource.name}->${target}`;
      if (!relationSet.has(key)) {
        relationSet.add(key);
        relations.push({ from: pascalCase(resource.name), to: pascalCase(target), type: 'many-to-one' });
      }
    }
  }

  ir.relations = relations;
  return ir;
}

export default applyRelationRules;
