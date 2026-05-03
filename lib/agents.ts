import { LlmAgent as Agent, FunctionTool as Tool } from '@google/adk';
import { 
  createSession, 
  updateSession, 
  createBeat, 
  bulkCreateKeyframes,
  updateBeat,
  getSession
} from './nocodb';

/**
 * Persistence Tool - Allows agents to interact with NocoDB
 */
export const persistenceTool = new Tool({
  name: 'persistence_tool',
  description: 'Saves story sessions, beats, and keyframes to the database.',
  execute: async (args: any) => {
    const { action, data } = args;
    switch (action) {
      case 'createSession':
        return await createSession(data);
      case 'updateSession':
        return await updateSession(data.sessionId, data.updates);
      case 'createBeat':
        return await createBeat(data);
      case 'bulkCreateKeyframes':
        return await bulkCreateKeyframes(data);
      case 'updateBeat':
        return await updateBeat(data.beatId, data.updates);
      default:
        throw new Error(`Unknown persistence action: ${action}`);
    }
  }
});

/**
 * Visual Generation Tool (Nano Banana Pro) - Native Google Gemini 3 Pro Image
 */
export const visualGenerationTool = new Tool({
  name: 'visual_generation_tool',
  description: 'Generates a 3x3 cinematic storyboard grid using the native Gemini 3 Pro Image model.',
  execute: async (args: any) => {
    const { prompt, referenceImageBase64, mimeType } = args;
    const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const MODEL = "gemini-3-pro-image-preview";
    const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    if (!API_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');

    const payload = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: referenceImageBase64 || "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            }
          },
          {
            text: `Transform the provided reference image into a cinematic sequence of 9 keyframes arranged in a 3x3 grid. 
                   Maintain strict continuity of characters and environment. 
                   Keyframes: ${prompt}`
          }
        ]
      }],
      generationConfig: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K"
        }
      }
    };

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Native Image Error: ${response.status} - ${err}`);
    }
    
    const data = await response.json();
    const generatedImageBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!generatedImageBase64) throw new Error('No image data in native Google response');
    
    return { base64Data: generatedImageBase64 };
  }
});

/**
 * Narrative Agent - Generates story structure and branches
 */
export const NarrativeAgent = new Agent({
  name: 'NarrativeAgent',
  description: 'Expert screenwriter that plans story arcs and generates context-aware branches.',
  model: 'gemini-3-flash-preview',
  instruction: `
    You are an expert screenwriter and interactive story designer.
    Your goal is to generate compelling story beats and branching options.
    
    When generating beats:
    - Follow the provided archetype structure.
    - Ensure a logical narrative flow based on the story seed.
    - Each beat must have a vivid scene description.
    
    When generating branches:
    - Create 2-3 distinct paths that feel like meaningful choices.
    - Ensure branches align with the desired story outcome (e.g., Happy Ending).
  `,
  tools: [persistenceTool]
});

/**
 * Visual Agent - Generates keyframe prompts and image orchestration
 */
export const VisualAgent = new Agent({
  name: 'VisualAgent',
  description: 'Storyboard artist that creates detailed visual prompts for AI image generation.',
  model: 'gemini-3-pro-image-preview',
  instruction: `
    You are a professional storyboard artist using the native Nano Banana Pro (Gemini 3 Pro Image) system.
    For each story beat, you generate 9 keyframe prompts.
    
    CRITICAL: You MUST use the 'visual_generation_tool' to create the actual storyboard grid for every beat. 
    You MUST provide the reference image in base64 format (provided in the user context) to the tool.
  `,
  tools: [persistenceTool, visualGenerationTool]
});
