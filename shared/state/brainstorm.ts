import { BrainstormAnnotation } from "@annotation";
import { Brainstorm } from "@types";
import { LanggraphData } from "langgraph-ai-sdk";

export type BrainstormGraphState = typeof BrainstormAnnotation.State;

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState, 
    typeof Brainstorm.messageSchema
>