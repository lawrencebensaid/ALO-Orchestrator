import assert from "assert";
import DB from "../src/foundation/DB";
import Environment from '../src/foundation/Environment';

const { env } = process;
global.environment = new Environment({
  secret: env.SECRET,
  debug: (env.DEBUG || "").toLowerCase() === "true",
  webDomain: env.WEB_DOMAIN,
  webHost: env.WEB_HOST,
  webPort: env.WEB_PORT,
  prodWebDomain: env.PROD_WEB_DOMAIN,
  devWebDomain: env.DEV_WEB_DOMAIN,
  dbmsHost: env.DB_HOST,
  dbmsPort: env.DB_PORT,
  dbmsUser: env.DB_USER,
  dbmsPassword: env.DB_PASSWORD,
  dbmsRealm: env.DB_REALM || "mongodb",
});

describe("DB", () => {
  describe("connect", () => {
    it("should be able to connect to the MongoDB database", async () => {
      const db = new DB(
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      );

      const dbo = await db.connect();
      await dbo.collection("groups").drop();
      await dbo.collection('groups').insertOne({ name: 'Julian' });

      
        return dbo.collection("groups").find().toArray().then((data) => {
          db.close();
          assert.strictEqual(1, data.length);
        });
    });
  });
});