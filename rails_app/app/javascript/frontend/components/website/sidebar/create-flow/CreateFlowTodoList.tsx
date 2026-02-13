import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import CreateFlowTodoItem from "./CreateFlowTodoItem";
import {
  PaintBrushIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  RectangleGroupIcon,
  PhotoIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  SwatchIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { useMemo, useEffect } from "react";
import {
  useWebsiteChatState,
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import { Spinner } from "@components/ui/spinner";
import type { Todo } from "@shared";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const keywordIconMap: [RegExp, IconComponent][] = [
  [/hero/i, StarIcon],
  [/image|photo|picture/i, PhotoIcon],
  [/copy|text|content|write|writing/i, ChatBubbleBottomCenterTextIcon],
  [/color|brand|theme|palette/i, PaintBrushIcon],
  [/section|layout|structure/i, RectangleGroupIcon],
  [/polish|final|finish|review/i, SparklesIcon],
  [/footer|nav|header|menu/i, GlobeAltIcon],
  [/code|build|develop/i, CodeBracketIcon],
  [/proof|testimonial|trust/i, DocumentTextIcon],
  [/call.to.action|cta|button|signup|form/i, CubeIcon],
  [/style|design|css/i, SwatchIcon],
];

/** All icons in preferred assignment order — keyword matches pull from here first. */
const allIcons: IconComponent[] = [
  StarIcon, PhotoIcon, ChatBubbleBottomCenterTextIcon, PaintBrushIcon,
  RectangleGroupIcon, SparklesIcon, GlobeAltIcon, CodeBracketIcon,
  DocumentTextIcon, CubeIcon, SwatchIcon, WrenchScrewdriverIcon,
];

/**
 * Assign icons to todos with keyword matching, but never repeat an icon
 * unless we exhaust the full pool.
 */
function assignIcons(todos: Todo[]): IconComponent[] {
  const used = new Set<IconComponent>();
  const result: IconComponent[] = new Array(todos.length);

  // First pass: keyword match, skip if already used
  for (let i = 0; i < todos.length; i++) {
    const content = todos[i].content;
    for (const [pattern, icon] of keywordIconMap) {
      if (pattern.test(content) && !used.has(icon)) {
        result[i] = icon;
        used.add(icon);
        break;
      }
    }
  }

  // Second pass: fill unassigned from the pool
  let poolIdx = 0;
  for (let i = 0; i < todos.length; i++) {
    if (result[i]) continue;
    while (poolIdx < allIcons.length && used.has(allIcons[poolIdx])) poolIdx++;
    if (poolIdx < allIcons.length) {
      result[i] = allIcons[poolIdx];
      used.add(allIcons[poolIdx]);
      poolIdx++;
    } else {
      // Exhausted pool — cycle through from the start
      result[i] = allIcons[i % allIcons.length];
    }
  }

  return result;
}

export default function CreateFlowTodoList() {
  const todos = useWebsiteChatState("todos");
  const isStreaming = useWebsiteChatIsStreaming();
  const hasTodos = todos && todos.length > 0;

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[CreateFlowTodoList]", {
        count: todos?.length ?? 0,
        isStreaming,
        ids: todos?.map((t) => t.id ?? "no-id"),
        statuses: todos?.map((t) => `${(t.id ?? "no-id").slice(0, 8)}:${t.status}`),
      });
    }
  }, [todos, isStreaming]);

  const icons = useMemo(
    () => (hasTodos ? assignIcons(todos) : []),
    [hasTodos, todos]
  );

  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">Landing Page Designer</CardTitle>
      <CardDescription className="flex flex-col gap-2 pt-1">
        {hasTodos ? (
          todos.map((todo, i) => (
            <CreateFlowTodoItem
              key={todo.id ?? todo.content}
              icon={icons[i]}
              label={todo.content}
              status={todo.status}
            />
          ))
        ) : (
          <div className="flex items-center gap-3 h-10 px-3 rounded-lg border border-neutral-300 bg-white">
            <Spinner className="size-4" />
            <span className="text-xs text-base-500">
              {isStreaming ? "Planning your website..." : "Preparing..."}
            </span>
          </div>
        )}
      </CardDescription>
    </CardHeader>
  );
}
