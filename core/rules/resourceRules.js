import { applySchemaInference } from './schemaInference.js';
import { applyRelationRules } from './relationRules.js';

const CRUD_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

function expandCrudMethods(methods = []) {
  const set = new Set(methods.map((m) => m.toUpperCase()));

  if (set.has('POST') || set.has('PUT') || set.has('PATCH') || set.has('DELETE')) {
    for (const method of CRUD_METHODS) set.add(method);
  }

  return Array.from(set).sort();
}

export function applyResourceRules(ir) {
  ir.resources = (ir.resources || []).map((resource) => ({
    ...resource,
    methods: expandCrudMethods(resource.methods)
  }));
  return ir;
}

export function applyRuleEngine(ir) {
  let next = structuredClone(ir);
  next = applyResourceRules(next);
  next = applySchemaInference(next);
  next = applyRelationRules(next);
  return next;
}

export default applyRuleEngine;
