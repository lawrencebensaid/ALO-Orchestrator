import { v4 as UUID } from "uuid"
import moment from "moment"
import Task from "./Task"
import Job from "./Job"


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Orchestrator {

  /**
   * @description Orchestrator.
   */
  constructor() {
    this.operationInterval = 1000;
    this.setStatus("idle");
    this.message = "Standing by";
    this.tasks = {};
    this.jobs = {};
    this.listeners = {};
    setInterval(() => {
      this.healthCheck();
      const tasks = this.getTasks("pending");
      for (const task of tasks) {
        if (task.startAt <= new Date()) {
          task.run();
          setTimeout(() => {
            if (task.status === "running") task.fail(task, "This Task has been terminated by the Orchestrator because it became unhealthy.");
          }, task.timeout);
          this.message = task.message;
        }
      }
      this.healthCheck();
    }, this.operationInterval);
    console.log("Orchestrator initialized");
  }


  /**
   * @description Registers a new listener.
   * @param {string} type 
   * @param {Function} callback 
   */
  on(type, callback) {
    if (typeof type !== "string") return;
    if (!Array.isArray(this.listeners[type])) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }


  /**
   * @description Calls all listeners of given type.
   * @param {string} type 
   * @param {*} callback 
   */
  send(type, data) {
    if (typeof type !== "string") return;
    if (!this.listeners) return;
    for (const listener of this.listeners[type]) {
      if (typeof listener === "function") listener(data);
    }
  }


  /**
   * @description Sets the status to the new status.
   * 
   * @param {string} status 
   */
  setStatus(status) {
    if (this.status == status) return;
    this.status = status;
    this.send("update", this.description());
  }


  /**
   * @description Starts attemt to cleaning up
   */
  cleanup() {
    this.setStatus("cleaning up")

    // Cleanup finished and failed Tasks
    const tasks = this.getTasks("finished").concat(this.getTasks("error"));
    if (tasks.length > 0 && this.isPruning()) {
      var increase = 1;
      for (let i = 0; i < tasks.length; i++) {
        increase++;
        const task = tasks[i];
        setTimeout(() => delete this.tasks[task.id], this.operationInterval * increase);
      }
    }
  }


  /**
   * @description Health check
   */
  healthCheck() {
    const tasksRunning = this.getTasks("running");
    const tasksFinished = this.getTasks("finished");
    const tasksErrored = this.getTasks("error");
    if (tasksRunning.length > 0) {
      this.setStatus("busy");
      return;
    }
    if (tasksFinished.length > 0 || tasksErrored.length > 0) {
      this.cleanup();
      return;
    }
    this.setStatus("idle");
    this.message = "Standing by";
  }


  /**
   * @description Checks wheather or not the orchestrator is cleaning up.
   * 
   * @returns {Bool}
   */
  isPruning() {
    return this.status === "cleaning up";
  }


  /**
   * @deprecated
   * 
   * @param {String} key 
   * @returns {Bool}
   */
  isUpdating(key) {
    const tasks = this.getTasks("running");
    for (const task of tasks) {
      if (task.key === key) {
        return true;
      }
    }
    return false;
  }


  /**
   * @description Gets all tasks. If a status has been specified the returned tasks will be filtered by status.
   * @see Task
   * 
   * @param {String?} status Task status
   */
  getTasks(status) {
    const tasks = [];
    for (const taskId in this.tasks) {
      const task = this.getTask(taskId);
      if (status && task.status !== status) continue;
      tasks.push(task);
    }
    return tasks;
  }


  /**
   * @description Returns a specific task if it exists.
   * @see Task
   * 
   * @param {String} id Identifier OR key of a task
   * @returns {Task}
   */
  getTask(id) {
    const task = this.tasks[id];
    if (task) {
      return task;
    } else {
      for (const taskId in this.tasks) {
        const task = this.tasks[taskId];
        console.log(`getTask(${id})`, task.key);
        if (task.key === id) return task;
      }
    }
  }


  /**
   * @description Schedules a Task.
   * @see Task
   * 
   * @param {Task} task 
   */
  scheduleTask(task) {
    if (!task instanceof Task) return;
    const { key } = task;

    // Check if task is already existent
    for (const taskId in this.tasks) {
      const task = this.tasks[taskId];
      if (task.key && task.key === key) {
        return; // Disgard task
      }
    }

    // Create task
    const id = UUID();
    task.id = id;
    task.status = "created";
    task.register(this);
    this.tasks[id] = task;
    this.send("update", task.description());
  }


  /**
   * @description Sets a Job.
   * @see Job
   * 
   * @param {Job} job
   */
  setJob(job, mayExecute) {
    if (!job instanceof Job) return;
    const { key } = job;

    // Check if job is already existent
    for (const jobId in this.jobs) {
      const job = this.jobs[jobId];
      if (job.key && job.key === key) {
        return; // Disgard job
      }
    }

    // Create job
    const id = UUID();
    job.id = id;
    job.mayExecute = mayExecute;
    job.register(this);
    this.jobs[id] = job;
    this.send("update", job.description());
  }


  /**
   * @description Returns a JSON description of the orchestrator's operations.
   */
  description({ humanReadable } = { humanReadable: false }) {
    const description = {
      status: this.status,
      message: this.message,
      jobs: [],
      tasks: []
    };
    for (const jobId in this.jobs) {
      const job = this.jobs[jobId];
      description.jobs.push(job.description({ humanReadable }));
    }
    for (const taskId in this.tasks) {
      const task = this.tasks[taskId];
      description.tasks.push(task.description({ humanReadable }));
    }
    return description;
  }


}


export default Orchestrator;