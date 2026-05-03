import { StoryWorkflow } from '../lib/workflows';
import { generateSessionId } from '../lib/nocodb';

/**
 * Test script for the Native ADK Story Workflow
 * Uses Gemini 3 Flash (Narrative) + Gemini 3 Pro Image (Visual)
 */
async function testWorkflow() {
  console.log('🚀 Starting Native ADK Story Workflow Test...');

  const sessionId = generateSessionId();
  const input = {
    sessionId,
    archetypeName: 'The Hero\'s Journey',
    outcomeName: 'Triumphant Success',
    referenceImageUrl: 'https://cloud.v1su4.dev/s/reference-image.png', // Placeholder or real URL
    referenceImageBase64: '...', // In a real test, this would be the base64 of the uploaded image
  };

  console.log(`📝 Session ID: ${sessionId}`);
  console.log('🎬 Executing StoryWorkflow...');

  try {
    const result = await StoryWorkflow.run(input);

    console.log('\n✅ Workflow Completion Success!');
    console.log('--- Workflow Output ---');
    console.log(`Received ${result.events.length} events from the workflow.`);

    // Log the last few events to see the final output
    const lastEvents = result.events.slice(-3);
    lastEvents.forEach((event: any, idx: number) => {
      console.log(`\nEvent [END-${3 - idx}]:`);
      console.log(JSON.stringify(event, null, 2).substring(0, 500) + '...');
    });
  } catch (error) {
    console.error('\n❌ Workflow Execution Failed:');
    console.error(error);
  }
}

testWorkflow();
