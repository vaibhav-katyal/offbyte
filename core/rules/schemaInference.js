const FIELD_TYPE_RULES = [
  { pattern: /email/i, type: 'String' },
  { pattern: /price|amount|cost|total|quantity|count|age/i, type: 'Number' },
  { pattern: /date|time|at$/i, type: 'Date' },
  { pattern: /^is[A-Z]|^has[A-Z]|^can[A-Z]|active|enabled|completed|verified/i, type: 'Boolean' },
  { pattern: /id$/i, type: 'ObjectId' }
];

export function inferFieldType(fieldName) {
  const matched = FIELD_TYPE_RULES.find((rule) => rule.pattern.test(fieldName));
  return matched ? matched.type : 'String';
}

export function applySchemaInference(ir) {
  ir.resources = (ir.resources || []).map((resource) => {
    resource.fields = (resource.fields || []).map((field) => ({
      ...field,
      type: field.type && field.type !== 'String' ? field.type : inferFieldType(field.name)
    }));
    return resource;
  });

  return ir;
}

export default applySchemaInference;
