import { twMerge } from "tailwind-merge";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@components/ui/spinner";

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface TodoListProps {
  todos: TodoItem[];
  className?: string;
}

/**
 * Compact inline todo list for displaying progress within chat.
 * Shows status indicator + content text in a tight vertical list.
 */
export function TodoList({ todos, className }: TodoListProps) {
  if (todos.length === 0) return null;

  return (
    <div className={twMerge("flex flex-col gap-1.5 py-2", className)}>
      {todos.map((todo, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="size-4 flex items-center justify-center flex-shrink-0">
            {todo.status === "completed" && (
              <CheckCircleIcon className="size-4 text-success-500" />
            )}
            {todo.status === "in_progress" && <Spinner className="size-3" />}
            {todo.status === "pending" && (
              <div className="size-2.5 rounded-full border border-neutral-300" />
            )}
          </div>
          <span
            className={twMerge(
              "text-xs",
              todo.status === "completed" && "text-base-400",
              todo.status === "in_progress" && "text-base-500",
              todo.status === "pending" && "text-base-400"
            )}
          >
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}
