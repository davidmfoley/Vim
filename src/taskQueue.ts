import * as _ from 'lodash';
import { logger } from './util/logger';

interface IEnqueuedTask {
  promise: () => Promise<void>;
  isRunning: boolean;
  queue: string;
  isHighPriority: boolean;
}

class TaskQueue {
  private _taskQueue: {
    [key: string]: {
      tasks: IEnqueuedTask[];
    };
  } = {};

  private isRunning(queueName: string): boolean {
    return (
      this._taskQueue[queueName] &&
      _.filter(this._taskQueue[queueName].tasks, x => x.isRunning).length > 0
    );
  }

  private numHighPriority(queueName: string): number {
    if (!this._taskQueue[queueName]) {
      return 0;
    }
    return _.filter(this._taskQueue[queueName].tasks, x => x.isHighPriority).length;
  }

  private async runTasks(queueName: string): Promise<void> {
    while (this._taskQueue[queueName].tasks.length > 0) {
      let task: IEnqueuedTask = this._taskQueue[queueName].tasks[0];

      try {
        task.isRunning = true;
        await task.promise();
        task.isRunning = false;
      } catch (e) {
        console.error(`TaskQueue: error running task. err=${e}.`);
      } finally {
        this.dequeueTask(task);
      }
    }
  }

  /**
   * Dequeues a task from the task queue.
   *
   * Note: If the task is already running, the semantics of
   *       promises don't allow you to stop it.
   */
  private dequeueTask(task: IEnqueuedTask): void {
    _.remove(this._taskQueue[task.queue].tasks, t => t === task);
  }

  /**
   * Adds a task to the task queue.
   */
  public enqueueTask(
    action: () => Promise<void>,
    queueName: string = 'default',
    isHighPriority: boolean = false
  ): void {
    let task: IEnqueuedTask = {
      promise: action,
      queue: queueName,
      isHighPriority: isHighPriority,
      isRunning: false,
    };

    if (!this._taskQueue[queueName]) {
      this._taskQueue[queueName] = {
        tasks: [],
      };
    }

    if (isHighPriority) {
      // Insert task as the last high priotity task.
      const numHighPriority = this.numHighPriority(queueName);
      this._taskQueue[queueName].tasks.splice(numHighPriority, 0, task);
    } else {
      this._taskQueue[queueName].tasks.push(task);
    }

    if (!this.isRunning(queueName)) {
      this.runTasks(queueName);
    }
  }
}

export let taskQueue = new TaskQueue();
