import { SequentialAgent, Runner } from '@google/adk';
import { NarrativeAgent, VisualAgent } from './agents';
import { InMemorySessionService } from '@google/adk';

/**
 * Story Workflow - Orchestrates the initial story generation using SequentialAgent
 */
export const StoryWorkflowAgent = new SequentialAgent({
  name: 'StoryWorkflowAgent',
  description: 'Generates the initial story session and the first few beats.',
  subAgents: [NarrativeAgent, VisualAgent],
});

export const StoryWorkflow = {
  run: async (input: any) => {
    const runner = new Runner({
      appName: 'Storyception',
      agent: StoryWorkflowAgent,
      sessionService: new InMemorySessionService(),
    });

    const instructionContent = `
      Start by using the NarrativeAgent to plan a story using the ${input.archetypeName} archetype.
      Outcome: ${input.outcomeName}
      Generate the first 2 beats and a story seed.
      Then, automatically pass control to the VisualAgent.
      The VisualAgent should generate 9 keyframe prompts for the generated beats and use the 'visual_generation_tool' to create the storyboard grids.
      Reference Image: ${input.referenceImageUrl || ''}
    `;

    const generator = runner.runEphemeral({
      userId: 'test-user',
      newMessage: { role: 'user', parts: [{ text: instructionContent }] }
    });

    const events = [];
    let finalContent = '';
    for await (const event of generator) {
      events.push(event);
      if (event.type === 'content' && event.content?.parts?.[0]?.text) {
        finalContent += event.content.parts[0].text;
      }
    }

    // Attempt to extract JSON from the agent's output
    let parsedData: any = {};
    try {
      const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Could not parse agent output as JSON');
    }

    return { 
      message: 'Workflow completed successfully',
      events: events,
      PlanStory: {
        story_title: parsedData.story_title || "Generated Title",
        story_logline: parsedData.story_logline || "Generated logline",
        story_seed: parsedData.story_seed || "Generated story seed",
        beats: parsedData.beats || []
      },
      GenerateVisuals: parsedData.beats || []
    };
  }
};

/**
 * Branch Workflow - Orchestrates progressive generation when a user picks a path
 */
export const BranchWorkflowAgent = new SequentialAgent({
  name: 'BranchWorkflowAgent',
  description: 'Generates context-aware branches and the next beat in the sequence.',
  subAgents: [NarrativeAgent, VisualAgent],
});

export const BranchWorkflow = {
  run: async (input: any) => {
    const runner = new Runner({
      appName: 'Storyception',
      agent: BranchWorkflowAgent,
      sessionService: new InMemorySessionService(),
    });

    const instructionContent = `
      Start by using NarrativeAgent to generate 2-3 branching options for the current story state.
      Story Seed: ${input.storySeed}
      Current Beat: ${input.currentBeatLabel}
      The user picked branch: ${input.selectedBranch}.
      Generate the next beat in the archetype sequence.
      Then pass control to VisualAgent to generate the 9 keyframe prompts and use 'visual_generation_tool' for the new beat.
    `;

    const generator = runner.runEphemeral({
      userId: 'test-user',
      newMessage: { role: 'user', parts: [{ text: instructionContent }] }
    });

    const events = [];
    let finalContent = '';
    for await (const event of generator) {
      events.push(event);
      if (event.type === 'content' && event.content?.parts?.[0]?.text) {
        finalContent += event.content.parts[0].text;
      }
    }

    // Attempt to extract JSON from the agent's output
    let parsedData: any = {};
    try {
      const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Could not parse agent output as JSON');
    }

    return { 
      message: 'Branch Workflow completed successfully',
      events: events,
      GenerateNextBeat: parsedData,
      GenerateNextVisuals: parsedData
    };
  }
};
