import { v4 as UUID } from "uuid";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Environment {

  /**
   * @description Responsible for managing the application context.
   * 
   * @param {String?} name Name of the Environment. 'Development' by default unless 'devWebDomain' is specified, then default will be 'Production'
   * @param {String?} secret 
   * @param {Boolean?} debug 
   * @param {String?} webDomain 
   * @param {String?} webHost 
   * @param {Number?} webPort 
   * @param {String?} devWebDomain 
   * @param {String?} dbmsName 
   * @param {String?} dbmsHost 
   * @param {Number?} dbmsPort 
   * @param {String?} dbmsUser 
   * @param {String?} dbmsPassword 
   * @param {String} dbmsRealm 
   */
  constructor({
    name,
    secret,
    debug,
    webDomain,
    webHost,
    webPort,
    devWebDomain,
    prodWebDomain,
    dbmsName,
    dbmsHost,
    dbmsPort,
    dbmsUser,
    dbmsPassword,
    dbmsRealm
  }) {
    this.name = name || (devWebDomain ? "Production" : "Development");
    this.secret = secret || UUID().split("-").join("");
    this.debug = debug || false;
    this.webDomain = webDomain || "localhost";
    this.webHost = webHost || "0.0.0.0";
    this.webPort = webPort || 80;
    this.siblings = [this];
    if (devWebDomain) {
      this.siblings.push(new Environment({ name: "Development", webDomain: devWebDomain }));
    }
    if (prodWebDomain) {
      this.siblings.push(new Environment({ name: "Production", webDomain: prodWebDomain }));
    }
    this.dbmsName = dbmsName || "alo-api";
    this.dbmsHost = dbmsHost || "localhost";
    this.dbmsPassword = dbmsPassword;
    this.dbmsRealm = dbmsRealm;
    switch (dbmsRealm) {
      case "mysql":
        this.dbmsPort = dbmsPort || 3306;
        this.dbmsUser = dbmsUser || "root";
        break;
      case "mongodb":
        this.dbmsPort = dbmsPort || 27017;
        this.dbmsUser = dbmsUser;
        break;
    }
  }


  /**
   * @description Compiles database connection URI
   * 
   * @returns {String?} Database connection URI.
   */
  getDatabaseURI({ includeDbName = false } = {}) {
    const { dbmsRealm: realm, dbmsUser: user, dbmsPassword: password, dbmsHost: host, dbmsPort: port, dbmsName: database } = this;
    switch (realm) {
      case "mysql":
        return `mysql://${user}${password ? `:${password}` : ""}@${host}:${port}/${database}`;
      case "mongodb":
        return `mongodb://${user ? `${password ? `${user}:${password}@` : `${user}@`}` : ""}${host}:${port}${includeDbName && database ? `/${database}` : ""}`;
      default:
        return null;
    }
  }


  /**
   * 
   */
  getSiblings() {
    return this.siblings;
  }


  /**
   * @param {String} environmentName 
   */
  getSibling(environmentName) {
    for (const environment of this.siblings) {
      if (environment.name === environmentName) {
        return environment;
      }
    }
    return null;
  }

}


export default Environment;