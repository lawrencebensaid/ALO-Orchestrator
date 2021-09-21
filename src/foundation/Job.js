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
    this.lastRun = null;
    this.nextRun = null;
  }


  /**
   * @description Starts the Job. MAY ONLY BE CALLED BY AN ORCHESTRATOR!
   * @private
   * @see Orchestrator
   * 
   * @param {Orchestrator} orchestrator The delegate Orchestrator who manages this Job.
   */
  register(orchestrator) {
    if (!(orchestrator instanceof Orchestrator)) {
      console.log("Job activation failed!");
      return;
    }
    this.orchestrator = orchestrator;
    if (this.task instanceof Task) {
      this.task.register(orchestrator);
    }
    this.nextRun = moment().add(this.interval, "milliseconds");
    this.timer = setInterval(() => {
      this.trigger(this);
      this.nextRun = moment().add(this.interval, "milliseconds");
    }, this.interval);
  }


  /**
   * @description Checks wheather or not the Job is running.
   * 
   * @returns {Bool}
   */
  isRunning() {
    if (!(this.task instanceof Task)) { return };
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
      job.lastRun = new Date();
      job.log.push({
        message: "Job triggered task",
        date: job.lastRun
      });
      if (!(this.orchestrator instanceof Orchestrator)) return;
      this.orchestrator.send("update");
    }
  }


  /**
   * @returns {object}
   */
  description({ humanReadable } = { humanReadable: false }) {
    const jobInfo = { id: this.key };
    const lastRun = moment(this.lastRun);
    if (lastRun.isValid()) jobInfo.lastRunAt = humanReadable ? lastRun.fromNow() : this.lastRun.valueOf();
    const nextRun = moment(this.nextRun);
    if (nextRun.isValid()) jobInfo.nextRunAt = humanReadable ? nextRun.fromNow() : this.nextRun.valueOf();
    jobInfo.message = this.isRunning() ? "Updating now" : `Updated ${lastRun.isValid() ? lastRun.fromNow() : "never"}`;
    return jobInfo;
  }

}


export default Job;