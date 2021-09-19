import { MongoClient } from "mongodb";
import WindesheimAzure, { fetchCookie, fetchPersonalCookie, getCookie } from "../foundation/WindesheimAzure";
import Task from "../foundation/Task";
import Job from "../foundation/Job";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class GroupController {

  /**
   * 
   */
  constructor() {

    (() => {
      // Notify Orchestrator.
      const task = new Task({
        key: `group.*`,
        message: `Running group update (all)`,
        timeout: 1000 * 60 * 1 // Terminate Task after 1 minute.
      }, async ({ update, succeed, fail }) => {

        try {
          const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
          const dbo = db.db(environment.dbmsName);
          const cookie = await getCookie();

          if (!cookie) {
            throw new Error("No token available at this time")
          }
          const groups = await new WindesheimAzure(cookie).fetchKlas();

          if (!Array.isArray(groups)) {
            fail("Invalid format");
            return;
          }

          for (const group of groups) {
            await dbo.collection("groups").updateOne({ group_code: group.code }, {
              $set: {
                group_code: group.code,
                group_name: group.klasnaam
              }
            }, { upsert: true });
          }

          db.close();
          succeed();
        } catch (error) {
          fail(error);
        }

      });

      const job = new Job({ task, key: `group.*`, interval: 1000 * 60 * 24 * 1 }); // Interval of 1 day.
      orchestrator.setJob(job, () => {

        const existingTask = orchestrator.getTask(`group.*`);
        const isUpdating = existingTask ? existingTask.isRunning() : false;

        if (isUpdating) {
          console.log(`An update is already in progress.`);
          return false;
        }

        return true;
      });

      job.trigger();
    })();

  }

  /**
   * @description 
   */
  async myIndex({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const cookie = await fetchPersonalCookie(username, password);
      const setting = await new WindesheimAzure(cookie).fetchPersonsSettingsKlas(username);
      const groups = [];
      JSON.parse(setting.value).forEach((row) => {
        groups.push(row.id);
      });

      resolve(groups);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Groups" });
    }
  }

  /**
   * @description 
   */
  async myUpdate({ session, body }, resolve, reject) {
    try {
      const { username, password } = session;
      const groups = body.groups || body.classes;
      const cookie = await fetchPersonalCookie(username, password);
      await new WindesheimAzure(cookie).updatePersonsSettingsKlas(username, groups);

      resolve({ message: "Group settings updated successfully." });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to update Groups" });
    }
  }


  /**
   * @description 
   */
  async index({ session }, resolve, reject) {
    try {
      const { username, password } = session;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {
        try {
          const cookie = await fetchCookie(username, password);
          const groups = await new WindesheimAzure(cookie).fetchKlas();

          for (const group of groups) {
            await dbo.collection("groups").updateOne({ group_code: group.code }, {
              $set: {
                group_code: group.code,
                group_name: group.klasnaam
              }
            }, { upsert: true });
          }

          orchestrator.getTask("group.*").run(); // DOES NOT WORK YET SOMEHOW...

        } catch (error) { }
      }

      const groups = await dbo.collection("groups").find().toArray();
      db.close();

      // Format
      groups.forEach((row, i, array) => {
        array[i] = {
          code: row.group_code,
          name: row.group_name
        }
      });

      resolve(groups);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Groups" });
    }
  }


  /**
   * @description 
   */
  async show({ session, params }, resolve, reject) {
    try {
      const { username, password } = session;
      const { id } = params;
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      if (username && password) {
        try {
          const cookie = await fetchCookie(username, password);
          const group = await new WindesheimAzure(cookie).fetchKlas(id);
          await dbo.collection("groups").updateOne({ group_code: group.code }, {
            $set: {
              group_code: group.code,
              group_name: group.klasnaam
            }
          }, { upsert: true });
        } catch (error) { }
      }
      const group = await dbo.collection("groups").findOne({ group_code: id });
      db.close();

      if (!group) {
        reject({ message: `Group '${id}' does not exist` });
        return;
      }

      resolve({
        code: group.group_code,
        name: group.group_name
      });
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Groups" });
    }
  }


  /**
   * @description 
   */
  async search({ params }, resolve, reject) {
    try {
      const { query } = params;
      const search = new RegExp(query, "i");
      const db = await MongoClient.connect(environment.getDatabaseURI(), { useNewUrlParser: true, useUnifiedTopology: true });
      const dbo = db.db(environment.dbmsName);
      const groups = await dbo.collection("groups").find({ $or: [{ group_name: { $regex: search } }, { group_code: { $regex: search } }] }).toArray();
      db.close();

      // Format
      groups.forEach((row, i, array) => {
        array[i] = {
          code: row.group_code,
          name: row.group_name
        }
      });

      resolve(groups);
    } catch (error) {
      console.log(error);
      reject({ message: "Failed to fetch Groups" });
    }
  }

}


export default GroupController;