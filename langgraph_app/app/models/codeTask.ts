import {
  type CodeTaskType,
  type TodoType,
  Task,
  codeTaskSchema,
} from "@types";
import { FileSpecificationModel } from "@models";
import { BaseModel } from "./base";
import { tasks, components, fileSpecifications } from "app/db";
export class CodeTaskModel extends BaseModel<typeof tasks, typeof codeTaskSchema> {
  static table = tasks;
  static schema = codeTaskSchema;
  static defaultScope = { type: 'CodeTask' }; // Essential to create this as a subclass

  /**
   * Define associations for this model (fallback for simple lookups)
   */
  protected static associations() {
    return {
      belongsTo: {
        component: { 
          table: components, 
          foreignKey: 'componentId', 
          nameField: 'name' 
        },
        fileSpecification: { 
          table: fileSpecifications, 
          foreignKey: 'fileSpecificationId', 
          nameField: 'componentType'  
        }
      }
    };
  }

  public static async sort(tasks: CodeTaskType[], by: "pageOrder"): Promise<CodeTaskType[]> {
    const fileSpecs = await FileSpecificationModel.where({
      id: tasks.map(task => task.fileSpecificationId) 
    });
    const sortedSpecs =  FileSpecificationModel.sort(fileSpecs, by);
    return sortedSpecs.map(spec => {
      const task = tasks.find(task => task.fileSpecificationId === spec.id);
      if (!task) {
        throw new Error(`Task not found for file spec ${spec.id}`);
      }
      return task;
    });
  }

  public static fromTodo(todo: TodoType): CodeTaskType {
    // get file from db -> get file spec id --> join
    // const fileSpec = fileSpecRegistry.get(todo.type);
    return {
      id: todo.id,
      type: Task.TypeEnum.CodeTask,
      subtype: todo.type,
      status: todo.status,
      instructions: todo.instructions,
    };
  }

}