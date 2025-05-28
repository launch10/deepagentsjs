import { atom, type WritableAtom } from 'nanostores';
import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import { createScopedLogger } from '@utils/logger';
import { unreachable } from '@utils/unreachable';
import { v4 as uuidv4 } from 'uuid';
import { 
  type CodeTask, 
         CodeTaskAction, 
         CodeTaskType,
         type CodeTaskResult,
        } from '@shared/models/codeTask';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';
export const HiddenTasks = [CodeTaskType.INSTALL, CodeTaskType.DEV_SERVER];

export type ActionCore = {
  messageId: string;
  task: CodeTask;
  title: string;
}
export type BaseActionState = ActionCore & {
  type: CodeTaskType; // CREATE_PAGE, CREATE_SECTION, UPDATE, INSTALL, SHELL
  action: CodeTaskAction; // UPDATE or DELETE
  status: Exclude<ActionStatus, 'failed'>;
  hidden: boolean;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  actions: ActionsMap = map({});
  devServerRunning = atom(false);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  nextActionId(): string {
    const actions = this.actions.get();
    return (Object.keys(actions).length + 1).toString();
  }

  addAction(task: CodeTask) {
    const { id } = task;

    const actions = this.actions.get();
    const action = actions[id];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(id, {
      title: task.title,
      task: task,
      type: task.type,
      action: task.action,
      hidden: HiddenTasks.includes(task.type),
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(id, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    } as ActionState);
  }

  async runAction(task: CodeTask): Promise<void> {
    const { id } = task;
    const action = this.actions.get()[id];

    if (!action) { // Should not happen if addAction is correct
      unreachable(`Action ${id} not found even after attempting to add.`);
    }

    if (action.executed) {
      return;
    }

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(id);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  async #executeAction(id: string) {
    const action = this.actions.get()[id];

    if (!action) {
      unreachable(`Action ${id} not found even after attempting to add.`);
    }

    // Double check abort status, as it might have been aborted while in queue
    if (action.abortSignal.aborted) {
        this.#updateAction(id, { status: 'aborted' });
        logger.info(`Action ${id} (type: ${action.type}) was aborted before execution started.`);
        return; // Don't proceed with execution
    }
    this.#updateAction(id, { ...action, status: 'running' });
    logger.info('Executing action', action);

    try {
      switch (action.type as ActionType) {
        case CodeTaskType.UPDATE: {
          await this.#runUpdateAction(action);
          break;
        }
        case CodeTaskType.CREATE_PAGE: {
          await this.#runUpdateAction(action);
          break;
        }
        case CodeTaskType.CREATE_SECTION: {
          await this.#runUpdateAction(action);
          break;
        }
        case CodeTaskType.INSTALL: {
          await this.#runInstallAction(action);
          break;
        }
        case CodeTaskType.SHELL: {
          await this.#runShellAction(action);
          break;
        }
        case CodeTaskType.MOUNT_FILES: {
          await this.#runMountFilesAction(action);
          break;
        }
        case CodeTaskType.DEV_SERVER: {
          await this.#runDevServerAction(action);
          break;
        }
        // case CodeTaskType.DELETE: {
        //   await this.#runDeleteAction(action);
        //   break;
        // }
        // case ActionType.Rename: {
        //   await this.#runRenameAction(action);
        //   break;
        // }
      }

      this.#updateAction(id, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      this.#updateAction(id, { status: 'failed', error: 'Action failed' });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== CodeTaskType.SHELL) {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    logger.debug(`Running shell command:`, action.task.payload?.command);
    const process = await webcontainer.spawn('bash', ['-c', action.task.payload?.command], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    // Create a decoder to handle the output stream
    let outputBuffer = '';
    // Create a reader for the output stream
    const reader = process.output.getReader();
    
    // Process output in the background
    const outputPromise = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Convert Uint8Array to string if necessary
          const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
          outputBuffer += text;
          logger.debug(`[Shell output]: ${text}`);
        }
      } catch (error) {
        logger.error('Error reading process output:', error);
      } finally {
        reader.releaseLock();
      }
    })();

    const longRunning = action.task.payload?.longRunning || false;
    if (longRunning) {
      const successPattern = action.task.payload?.successPattern;
      const timeoutMs = action.task.payload?.timeoutMs || 60000;
      let resolved = false;
    
      // Create a promise that resolves when the success pattern is found
      const successPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (successPattern && outputBuffer.includes(successPattern)) {
            clearInterval(checkInterval);
            if (!resolved) {
              resolved = true;
              resolve('success');
            }
          }
        }, 100); // Check every 100ms
        
        // Clean up the interval when the process exits
        process.exit.then(() => {
          clearInterval(checkInterval);
        });
      });
      
      // Create a promise that resolves after the timeout
      const timeoutPromise = new Promise(resolve => {
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve('timeout');
          }
        }, timeoutMs);
      });
      
      // Wait for either the success pattern or the timeout
      const result = await Promise.race([successPromise, timeoutPromise]);
      logger.debug(`Long-running process ${result === 'success' ? 'succeeded' : 'timed out'}`);
      
      if (result === 'timeout') {
        process.kill();
        // You might want to throw an error here or handle the timeout in some way
      }
    } else {
      const exitCode = await process.exit;
      logger.debug(`Process terminated with code ${exitCode}`);
    }
  }

  async #runMountFilesAction(action: ActionState) {
    if (action.type !== CodeTaskType.MOUNT_FILES) {
      unreachable('Expected mount files action');
    }

    const webcontainer = await this.#webcontainer;

    logger.debug(`Running mount files action`);
    webcontainer.mount(action.task.payload?.files);
  }

  async #runInstallAction(action: ActionState) {
    if (action.type !== CodeTaskType.INSTALL) {
      unreachable('Expected reload action');
    }

    await this.#createAction(CodeTaskType.SHELL, { command: `npm install` }, "Installing");
  }

  async #runDevServerAction(action: ActionState) {
    if (action.type !== CodeTaskType.DEV_SERVER) {
      unreachable('Expected dev server action');
    }

    this.#createAction(CodeTaskType.SHELL, { 
      command: `npm run dev`, 
      longRunning: true,
      successPattern: 'ready in',
      timeoutMs: 30000,
    }, "Preparing preview");
  }

  async #runDeleteAction(action: ActionState) {
    if (action.type !== CodeTaskType.DELETE) {
      unreachable('Expected delete action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.data.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });
  }

  async #runRenameAction(action: ActionState) {
    if (action.type !== CodeTaskType.RENAME) {
      unreachable('Expected rename action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.data.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });
  }

  // add dependency always runs npm install <package-name>
  async #runAddDependencyAction(action: ActionState) {
    if (action.type !== CodeTaskType.ADD_DEPENDENCY) {
      unreachable('Expected add-dependency action');
    }

    const webcontainer = await this.#webcontainer;

    // We want this to run 
    const process = await webcontainer.spawn('npm', ['install', `${action.data.name}@${action.data.version}`, '--save'], {
      // env: { npm_config_yes: true }, // Likely not needed for npm run dev
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          logger.debug(data);
        },
      }),
    );

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  getDirname(filePath: string): string {
    // Find the last '/'
    const lastSlashIndex = filePath.lastIndexOf('/');
    
    // If no slash, or it's the only character (e.g., "/"), return '.'
    if (lastSlashIndex <= 0) {
      return '.';
    }
    
    // Return the part before the last slash
    let dir = filePath.substring(0, lastSlashIndex);
    
    // Handle potential root case (e.g. '/foo' -> '/')
    if (dir === '') return '/';

    // remove trailing slashes
    dir = dir.replace(/\/+$/g, '');
    return dir;
  }

  async #runUpdateAction(action: ActionState) {
    if (action.action !== CodeTaskAction.UPDATE) {
      unreachable('Expected update action');
    }

    const webcontainer = await this.#webcontainer;
    const { filePath, code } = action.task.results as CodeTaskResult;

    // Create folder if it doesn't exist
    const dirname = this.getDirname(filePath as string);
    if (dirname !== '.') {
      try {
        await webcontainer.fs.mkdir(dirname, { recursive: true });
        logger.debug(`Folder created ${dirname}`);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await webcontainer.fs.writeFile(filePath as string, code as string);
      logger.debug(`File written ${filePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  #buildAction(type: ActionType, data: any, title: string) {
    const abortController = new AbortController();
    const action = {
      id: `${title}${type}`,
      title,
      type,
      action: CodeTaskAction.UPDATE,
      payload: data,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
      },
      abortSignal: abortController.signal
    } as ActionState;

    return action;
  }
  /**
   * Helper method to create a properly formatted action with all required properties
   */
  #createAction<T extends ActionType>(type: T, data: any, title: string): ActionState {
    const action = this.#buildAction(type, data, title);
    this.addAction(action);
    this.runAction(action);
    return action;
  }

}
