function makeMemModel(initial = []) {
  let data = Array.isArray(initial) ? [...initial] : [];

  const api = {
    async create(obj) {
      const _id = obj._id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = obj.createdAt || new Date();
      const item = { ...obj, _id, createdAt };
      data.push(item);
      return item;
    },

    async findOne(query = {}) {
      return data.find((row) =>
        Object.entries(query).every(([k, v]) => row[k] === v)
      ) || null;
    },

    find(query = {}) {
      const rows = data.filter((row) =>
        Object.entries(query).every(([k, v]) => row[k] === v)
      );

      return {
        sort(sortObj = {}) {
          const [[key, dir]] = Object.entries(sortObj);
          const sorted = [...rows].sort((a, b) => {
            const av = a[key], bv = b[key];
            if (av < bv) return dir < 0 ? 1 : -1;
            if (av > bv) return dir < 0 ? -1 : 1;
            return 0;
          });
          return Promise.resolve(sorted);
        }
      };
    }
  };

  return api;
}

module.exports = { makeMemModel };
