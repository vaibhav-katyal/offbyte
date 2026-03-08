export function createField(name, type = 'String', required = false, extra = {}) {
  return { name, type, required, ...extra };
}

export function createResource({ name, path, fields = [], methods = [] }) {
  return {
    name,
    path,
    fields,
    methods: Array.from(new Set(methods)).sort()
  };
}

export function createRelation({ from, to, type = 'many-to-one' }) {
  return { from, to, type };
}

export function createIR({ resources = [], relations = [], auth = { enabled: false }, database = 'mongodb' } = {}) {
  return {
    resources,
    relations,
    auth,
    database
  };
}
