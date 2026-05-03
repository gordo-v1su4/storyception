import { visualGenerationTool } from '../lib/agents';
import fs from 'fs';
import path from 'path';

/**
 * Test script for the Native Nano Banana Pro (Gemini 3 Pro Image) Tool
 */
async function testNativeImageTool() {
  console.log('🎨 Testing Native Nano Banana Pro Tool...');

  // 1. Prepare dummy base64 for testing (or read a real file if available)
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  const prompt = "A futuristic samurai standing in the rain, neon city background, cinematic 3x3 grid.";

  console.log('🎬 Calling visual_generation_tool...');

  try {
    // Call the execute function directly
    const executeFunc = (visualGenerationTool as any).execute;
    const result = await executeFunc({
      prompt,
      referenceImageBase64: dummyBase64,
      mimeType: "image/png"
    });

    console.log('\n✅ Tool Execution Success!');
    console.log(`🖼️ Generated Grid (Base64 length): ${result.base64Data.length}`);
    
    // Save to file for verification
    const outputPath = path.join(process.cwd(), 'test_scripts', 'native_grid_output.png');
    fs.writeFileSync(outputPath, Buffer.from(result.base64Data, 'base64'));
    console.log(`💾 Saved test output to: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Tool Execution Failed:');
    console.error(error);
  }
}

testNativeImageTool();
