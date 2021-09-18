import Orchestrator from "./Orchestrator"
import Task from "./Task"
import moment from "moment"


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Job {

  /**
   * @description A job is a repeating scheduling of a task with a specified interval which is managed by an Orchestrator. The given task can not be changed once the Job has been activated.
   * @see Orchestrator
   * 
   * @param {Task} task
   * @param {String} key Key identifier of the job.
   * @param {Number} interval Interval in miliseconds
   * @param {Function} mayExecute Time-of-flight condition; Will run to check for a GO, Once this callback returns 'true' the job will execute the task.
   */
  constructor({ key, interval, task, mayExecute }) {
    this.key = key;
    this.interval = interval;
    this.task = task;
    this.log = [];
    this.mayExecute = mayExecute;
    this.timer = null;
    this.ranAt = null;
  }


  /**
   * @description Starts the Job. MAY ONLY BE CALLED BY AN ORCHESTRATOR!
   * @private
   * @see Orchestrator
   * 
   * @param {Orchestrator} orchestrator The delegate Orchestrator who manages this Job.
   */
  register(orchestrator) {
    if (!orchestrator instanceof Orchestrator) {
      console.log("Job activation failed!");
      return;
    }
    this.orchestrator = orchestrator;
    this.timer = setInterval(() => { this.trigger(this) }, this.interval);
  }


  /**
   * @description Checks wheather or not the Job is running.
   * 
   * @returns {Bool}
   */
  isRunning() {
    return this.task.isRunning();
  }


  /**
   * @description Schedules the Job's Task now.
   */
  trigger(self) {
    const job = self || this;
    const condition = typeof job.mayExecute === "function" ? job.mayExecute : () => false;
    const allow = condition();
    console.log(`Request to trigger job '${job.key}' has been ${allow ? "APPROVED" : "DENIED"}!`);
    if (job.task instanceof Task && allow) {
      job.task.startAt = new Date();
      job.orchestrator.scheduleTask(job.task);
      job.ranAt = new Date();
      job.log.push({
        message: "Job triggered task",
        date: job.ranAt
      });
    }
  }


  /**
   * @returns {object}
   */
  description({ humanReadable } = { humanReadable: false }) {
    const jobInfo = { id: this.key };
    const ranAt = moment(this.ranAt);
    if (ranAt.isValid()) {
      jobInfo.ranAt = humanReadable ? ranAt.fromNow() : this.ranAt.valueOf();
    }
    jobInfo.message = this.isRunning() ? "Updating now" : `Updated ${ranAt.isValid() ? ranAt.fromNow() : "never"}`;
    return jobInfo;
  }

}


export default Job;