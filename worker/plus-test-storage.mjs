// Mirrors SQLite synchronous KV serialization, rollback, alarms and output-durability wait.
export function audioStorage(rows = new Map()) {
  const storage = {
    rows, alarm: null,
    kv: {
      get: key => structuredClone(rows.get(key)),
      put(key, value) { rows.set(key, structuredClone(value)); },
      delete: key => rows.delete(key),
      list: ({ prefix = '', limit = Infinity } = {}) => new Map([...rows].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).slice(0, limit).map(([k, v]) => [k, structuredClone(v)]))
    },
    transactionSync(fn) {
      const before = structuredClone(rows);
      try { return fn(); } catch (error) { rows.clear(); for (const [k, v] of before) rows.set(k, v); throw error; }
    },
    sync: async () => {},
    setAlarm: async value => { storage.alarm = value; },
    deleteAlarm: async () => { storage.alarm = null; }
  };
  return storage;
}
