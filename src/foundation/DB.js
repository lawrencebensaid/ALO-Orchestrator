import { MongoClient } from "mongodb";

/**
 * @author Julian Quispel <julian.quispel@windesheim.nl>
 */
class DB {

  /**
   * @description Responsible for managing the MongoDB connection
   * 
   * @param {Object?} options MongoDB connection options.
   */
  constructor(options = {}) {
    this.uri = environment.getDatabaseURI();
    this.databaseName = environment.dbmsDatabase;
    this.options = options;
  }


  /**
   * @description Opens a new MongoDB connection.
   */
  async connect() {
    return await new Promise((resolve, reject) => {
      MongoClient.connect(this.uri, this.options, (err, db) => {
        if (err) reject(err);
        this.client = db;
        resolve(this.client.db(this.databaseName));
      });
    });
  }


  /**
   * @description Closes the connection.
   */
  async close() {
    return await this.client.close();
  }

}

export default DB;