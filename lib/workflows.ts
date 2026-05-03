import './adk-env';
import { SequentialAgent, Runner } from '@google/adk';
import { createNarrativeAgent, createVisualAgent } from './agents';
import { InMemorySessionService } from '@google/adk';

const storyNarrativeAgent = createNarrativeAgent('NarrativeAgent');
const storyVisualAgent = createVisualAgent('VisualAgent');
const branchNarrativeAgent = createNarrativeAgent('BranchNarrativeAgent');
const branchVisualAgent = createVisualAgent('BranchVisualAgent');

/**
 * Story Workflow - Orchestrates the initial story generation using SequentialAgent
 */
export const StoryWorkflowAgent = new SequentialAgent({
  name: 'StoryWorkflowAgent',
  description: 'Generates the initial story session and the first few beats.',
  subAgents: [storyNarrativeAgent, storyVisualAgent],
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
      Reference Image: ${input.referenceImageUrl || input.referenceImages?.[0] || ''}
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
  subAgents: [branchNarrativeAgent, branchVisualAgent],
});

function normalizeWorkflowBranches(parsedData: Record<string, unknown>): {
  label: string
  outcome_hint: string
}[] {
  const raw =
    parsedData.branches ??
    parsedData.branch_options ??
    parsedData.options ??
    []
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: unknown, i: number) => {
      if (typeof item === 'string')
        return { label: `Path ${i + 1}`, outcome_hint: item }
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const label = o.label ?? o.title ?? o.name ?? `Branch ${i + 1}`
      const outcome_hint =
        o.outcome_hint ?? o.description ?? o.desc ?? o.hint ?? ''
      return {
        label: String(label),
        outcome_hint: String(outcome_hint),
      }
    })
    .filter((b): b is { label: string; outcome_hint: string } =>
      Boolean(b && (b.label || b.outcome_hint))
    )
}

export const BranchWorkflow = {
  run: async (input: any) => {
    const runner = new Runner({
      appName: 'Storyception',
      agent: BranchWorkflowAgent,
      sessionService: new InMemorySessionService(),
    })

    const previous =
      Array.isArray(input.previousBeats) && input.previousBeats.length > 0
        ? input.previousBeats
            .map(
              (b: {
                label?: string
                description?: string
                selectedBranch?: string
              }) =>
                `- ${b.label ?? ''}: ${b.description ?? ''}` +
                (b.selectedBranch
                  ? ` (chosen path: ${b.selectedBranch})`
                  : '')
            )
            .join('\n')
        : ''

    const instructionContent = `
      Start by using BranchNarrativeAgent to generate 2-3 branching options for the current story state.
      Story context:\n${input.storySeed || '(none)'}
      ${previous ? `Earlier beats:\n${previous}\n` : ''}
      Current Beat: ${input.currentBeatLabel}
      The user has not chosen a branch yet — propose distinct narrative paths only.
      Respond with JSON containing a "branches" array; each item has "label" and "outcome_hint" (or "title" and "description").
      Optionally continue with BranchVisualAgent for the next beat only if the flow naturally requires it.
    `

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

    const branches = normalizeWorkflowBranches(parsedData as Record<string, unknown>)
    const fallback =
      branches.length > 0
        ? branches
        : [
            { label: 'Direct confrontation', outcome_hint: 'Face the conflict head-on.' },
            { label: 'Seek another way', outcome_hint: 'Find a clever or hidden path forward.' },
            {
              label: 'Step back and observe',
              outcome_hint: 'Gather information before committing.',
            },
          ]

    return {
      message: 'Branch Workflow completed successfully',
      events: events,
      GenerateNextBeat: parsedData,
      GenerateNextVisuals: parsedData,
      GenerateBranches: { branches: fallback },
    }
  },
};
