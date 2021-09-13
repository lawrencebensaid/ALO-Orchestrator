import fs from "fs";
import Cache from "../foundation/Cache";

class Course {

  /**
   * @param {Number} id 
   * @param {String} code 
   * @param {String} name 
   * @param {String} thumbnail 
   * @param {Array} filemap 
   */
  constructor(id, code, name, thumbnail, filemap) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.thumbnail = thumbnail;
    this.filemap = filemap;
  }


  /**
   * @description Saves the object to the cache.
   */
  save() {
    Cache.store("courses", { id: this.id, code: this.code, name: this.name, thumbnail: this.thumbnail, filemap: this.filemap });
  }

}

export default Course;