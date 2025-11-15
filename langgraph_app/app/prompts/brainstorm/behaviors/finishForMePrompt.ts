import fs from "fs";
import path from "path";
import { type BrainstormGraphState } from "@state";
import { Brainstorm, type LangGraphRunnableConfig, isHumanMessage } from "@types";
import { renderPrompt } from "@prompts";
import { arrayDifference } from "@utils";
import {
    whereWeArePrompt,
    remainingTopicsPrompt,
    collectedAnswersPrompt,
    backgroundPrompt,
} from "../core";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const finishForMePrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }
    const topics = arrayDifference(
        state.remainingTopics.concat(state.skippedTopics),
        ['lookAndFeel']
    )

    const topicSpecificHelp = await Promise.all(
        topics.map(topic => fs.promises.readFile(path.join(__dirname, `../help/${topic}.md`), 'utf-8'))
    ).then((helpText) => helpText.join("\n\n"))

    const [whereWeAre, collectedAnswers, background] = await Promise.all([
        whereWeArePrompt(state, config),
        collectedAnswersPrompt(state, config),
        backgroundPrompt(state, config),
    ]);

    return renderPrompt(
        `
            ${background}

            ${whereWeAre}

            <context>
                The user skipped ${topics.length} questions during the brainstorm.
                You are now tasked with helping them finish the brainstorm, using the answers they have provided.
            </context>

            <role>
                You are a highly paid marketing consultant and strategist who specializes in helping businesses develop 
                HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.
            </role>
            
            <task>
                Create plausible answers for the skipped topics based on the answers the user has provided.

                Do not invent answers or make things up. Use the information provided to create realistic answers.
            </task>

            ${collectedAnswers}

            ${Brainstorm.topicsAndDescriptions(topics as Brainstorm.TopicName[])}

            ${topicSpecificHelp}

            <task>
                Provide a clear, fill-in-the-blank template that helps them articulate their answer with specificity and clarity.
            </task>

            <workflow>
                1. Call the save_answers tool with the answers you have created for the skipped topics.
            </workflow>

            <output_format_rules>
                Do not output any text. Call the save_answers tool with the answers you have created for the skipped topics.
            </output_format_rules>
        `
    );
}