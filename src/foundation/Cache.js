import fs from "fs";
import path from "path";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Cache {

  /**
   * Persistent cache
   */
  constructor() {

  }

}


Cache.location = "../../../.cache";


/**
 * Empties/Clears the persistent cache.
 */
Cache.clear = () => {
  fs.rmdirSync(location);
};


/**
 * Empties/Clears the persistent cache.
 */
Cache.shred = (container) => {
  fs.unlinkSync(Cache.containerURI(container));
};


/**
 * @returns {String} Cache URI.
 */
Cache.cacheURI = () => {
  return path.normalize(`${__dirname}${Cache.location}`);
}


/**
 * @returns {String} Container URI.
 */
Cache.containerURI = (container) => {
  return path.normalize(`${__dirname}${Cache.location}/${container}.cache`);
}


/**
 * @param {String} container Container name
 */
Cache.modifiedAt = (container, id) => {
  Cache.validate(container);
  const path = Cache.containerURI(container);
  const cache = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
  var modifiedAt = null;
  if (id) {
    const store = Array.isArray(cache.store) ? cache.store : [];
    for (const row of store) {
      if (id && id != row.record[cache.key]) {
        continue;
      }
      modifiedAt = parseInt(row.modifiedAt);
      break;
    }
  } else {
    modifiedAt = parseInt(cache.modifiedAt);
  }
  return modifiedAt ? new Date(modifiedAt * 1000) : null;
};


/**
 * @param {String} container Container name
 */
Cache.setUpdating = (container) => {
  Cache.validate(container);
  const path = Cache.containerURI(container);
  const cache = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
  fs.writeFileSync(path, JSON.stringify(cache), { encoding: "utf8" });
};


/**
 * Validates cache/container integrity.
 * @param {String?} container Container name
 * @returns {Boolean}
 */
Cache.validate = (container) => {
  const key = typeof arguments[1] === "string" ? arguments[1] : "id";
  if (!fs.existsSync(".cache")) {
    fs.mkdirSync(".cache");
  }
  if (typeof container === "string") {
    const uri = Cache.containerURI(container);
    if (!fs.existsSync(uri)) {
      fs.writeFileSync(uri, `{"store":[],"key":"${key}","modifiedAt":null}`, { encoding: "utf8" });
    }
  }
  return true;
};


/**
 * Returns all items of a container.
 * @param {String} container Container name
 * @returns {Array}
 */
Cache.get = (container, id) => {
  Cache.validate(container);
  const path = Cache.containerURI(container);
  const cache = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
  const store = Array.isArray(cache.store) ? cache.store : [];
  const records = [];
  for (const row of store) {
    if (id && id != row.record[cache.key]) {
      continue;
    }
    records.push(row.record);
  }
  return records;
};


/**
 * Returns a list of containers.
 * @returns {Array}
 */
Cache.containers = () => {
  if (!fs.existsSync(Cache.cacheURI())) {
    return [];
  }
  const items = fs.readdirSync(Cache.cacheURI());
  const containers = [];
  for (const item of items) {
    const components = item.split(".");
    if (components[1] === "cache") {
      containers.push(components[0]);
    }
  }
  return containers;
};


/**
 * Stores item into Cache
 * @param {String} container Container name
 */
Cache.store = (container, update) => {
  const path = Cache.containerURI(container);
  Cache.validate(container);
  const cache = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
  const modifiedAt = parseInt(new Date().valueOf() / 1000);
  cache.modifiedAt = modifiedAt;
  // Update existing record
  const key = cache.key;
  var exists = false;
  for (const existing of cache.store) {
    const { record } = existing;
    if (record[key] === update[key]) {
      exists = true;
      for (const property in existing.record) {
        existing.record[property] = record[property] || update[property];
      }
      for (const property in update) {
        existing.record[property] = record[property] || update[property];
      }
      existing.modifiedAt = modifiedAt;
      break;
    }
  }
  // Push new record into store
  if (!exists) {
    cache.store.push({ modifiedAt, record: update });
  }
  fs.writeFileSync(path, JSON.stringify(cache), { encoding: "utf8" });
};


export default Cache;