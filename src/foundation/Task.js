import Orchestrator from "./Orchestrator";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class Task {

  /**
   * @description A Task is a procidure which can be executed by an Orchestrator.
   * @see Orchestrator
   * 
   * @param {String} key Key identifier of the task.
   * @param {String} message This text will be displayed by the orchestrator as a status message.
   * @param {Date} startAt Execution time.
   * @param {Number} timeout Timeout in miliseconds. When this time expires the task will fail.
   * @param {Function} execution Execution closure.
   */
  constructor({ key, message, startAt, timeout }, execution) {
    this.key = key;
    this.message = message || null;
    this.timeout = timeout;
    this.status = "pending";
    this.startAt = startAt instanceof Date ? startAt : new Date();;
    this.startedAt = null;
    this.execution = typeof execution === "function" ? execution : ({ update, succeed, fail }) => { fail("Execution missing!") };
    this.progress = 0; // Progress percentage.
  }


  /**
   * @description Registers the Task. MAY ONLY BE CALLED BY AN ORCHESTRATOR!
   * @private
   * @see Orchestrator
   * 
   * @param {Orchestrator} orchestrator The delegate Orchestrator who manages this Task.
   */
  register(orchestrator) {
    if (!orchestrator instanceof Orchestrator) {
      console.log("Task activation failed!");
      return;
    }
    this.status = "pending";
  }


  /**
   * @description Runs the task
   * 
   * @returns {Bool} Success
   */
  run() {
    if (this.status != "pending") {
      return false;
    }
    this.status = "running";
    this.startedAt = new Date();
    this.execution({
      update: (message) => { this.update(this, message) },
      succeed: (message) => { this.succeed(this, message) },
      fail: (message) => { this.fail(this, message) }
    });
    return true;
  }


  /**
   * @description Internal method for updating the task's progress.
   * @private
   * 
   * @param {Task} task 
   */
  update(task, percentage) {
    if (typeof percentage === "number" && percentage >= 0 && percentage <= 1) {
      task.progress = percentage;
    }
  }


  /**
   * @description Internal method for marking the task as 'finished'.
   * @private
   * 
   * @param {Task} task 
   */
  succeed(task, message) {
    if (task.status === "running") {
      task.status = "finished";
    }
    task.progress = 1;
    task.message = message;
    console.log(`Task '${task.key}' succeeded!${message ? ` '${message}'` : ""}`);
  }


  /**
   * @description Internal method for marking the task as 'error'.
   * @private
   * 
   * @param {Task} task 
   */
  fail(task, message) {
    if (task.status === "running") {
      task.status = "error";
    }
    task.message = message;
    console.log(`Task '${task.key}' failed!${message ? ` '${message}'` : ""}`);
  }


  /**
   * @description Checks wheather or not the Task is running.
   * 
   * @returns {Bool}
   */
  isRunning() {
    return this.status === "running";
  }

}


export default Task;