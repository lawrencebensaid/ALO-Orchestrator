import Cache from "./foundation/Cache";
import moment from "moment";
import Task from "./foundation/Task";
import Job from "./foundation/Job";
import ELO from "./foundation/ELO";

// Orchestrator hints (in seconds)
const TTL_MIN = 60 * 30;
const TTL_MAX = 60 * 5;


export default async function (username, password, id, code = null) {
  return new Promise(async (resolve, reject) => {

    // Notify Orchestrator.
    const task = new Task({ key: `course/${code}`, message: `Running course ${code} update`, timeout: 1000 * 60 * 5 }, async ({ update, succeed, fail }) => {
      try {
        const course = await new ELO(username, password).fetchCourseFiles(id, { onUpdate: update } );
        succeed();
        resolve(course);
      } catch (error) {
        fail(error);
        reject();
      }
    });

    const job = new Job({ task, key: `course/${code}`, interval: 1000 * TTL_MAX });
    orchestrator.setJob(job, () => {

      const modified = Cache.modifiedAt("courses", code);
      const expiration = moment(modified).add(TTL_MIN, "seconds");
      const existingTask = orchestrator.getTask(`course/${code}`);
      const isUpdating = existingTask ? existingTask.isRunning() : false;

      if (isUpdating) {
        console.log(`An update is already in progress.`);
        return false;
      } if (!expiration.isValid()) {
        orchestrator.message = `Updating course ${code} because I don't remember the last time I updated.`;
        return true;
      } else if (expiration < new Date()) {
        orchestrator.message = `Updating course ${code} because cache TTL has expired ${moment(modified).fromNow()}.`;
        return true;
      }

      console.log(`No update needed because an update took place ${moment(modified).fromNow()}.`);
      return false;
    });

    job.trigger();

  });

}
