# Nano Banana Pro API Reference

**Model:** `gemini-3-pro-image-preview`  
**Purpose:** Professional asset production with advanced reasoning and high-fidelity text rendering

## Overview

Nano Banana Pro is Gemini's native image generation model designed for professional asset production. It features:
- **Advanced Reasoning:** Default "Thinking" process that refines composition prior to generation
- **High-Fidelity Text:** Can render text within images
- **Real-World Grounding:** Uses Google Search for context
- **High Resolution:** Supports up to 4K resolution generation
- **SynthID Watermark:** All generated images include a SynthID watermark

## API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent
```

**Headers:**
```
x-goog-api-key: YOUR_API_KEY
Content-Type: application/json
```

## Text-to-Image Generation

### Python

```python
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

prompt = "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config={
        imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
        },
    }
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```

### JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

async function main() {
  const ai = new GoogleGenAI({});

  const prompt = "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",
      },
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("gemini-native-image.png", buffer);
      console.log("Image saved as gemini-native-image.png");
    }
  }
}

main();
```

### REST API

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [
        {"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
      ]
    }],
    "generationConfig": {
      "imageConfig": {
        "aspectRatio": "16:9",
        "imageSize": "2K"
      }
    }
  }'
```

## Image Editing (Text-and-Image-to-Image)

### Python

```python
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

# Load reference image
with open("reference_image.jpg", "rb") as f:
    image_data = f.read()

prompt = [
    types.Part.from_bytes(image_data, mime_type="image/jpeg"),
    "Make the background more dramatic with storm clouds"
]

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=prompt,
    config={
        imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
        },
    }
)

for part in response.parts:
    if part.inline_data is not None:
        image = part.as_image()
        image.save("edited_image.png")
```

### JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

async function main() {
  const ai = new GoogleGenAI({});

  // Load reference image
  const imageData = fs.readFileSync("reference_image.jpg");
  const base64Image = imageData.toString("base64");

  const prompt = [
    {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    },
    "Make the background more dramatic with storm clouds"
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",
      },
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync("edited_image.png", buffer);
    }
  }
}

main();
```

## Image Configuration

### Aspect Ratios and Resolutions

Nano Banana Pro supports multiple aspect ratios with three resolution options:

| Aspect Ratio | 1K Resolution | 1K Tokens | 2K Resolution | 2K Tokens | 4K Resolution | 4K Tokens |
| ------------ | -------------- | --------- | ------------- | --------- | -------------- | --------- |
| **1:1**      | 1024x1024      | 1120      | 2048x2048     | 1120      | 4096x4096      | 2000      |
| **2:3**      | 848x1264       | 1120      | 1696x2528     | 1120      | 3392x5056      | 2000      |
| **3:2**      | 1264x848       | 1120      | 2528x1696     | 1120      | 5056x3392      | 2000      |
| **3:4**      | 896x1200       | 1120      | 1792x2400     | 1120      | 3584x4800      | 2000      |
| **4:3**      | 1200x896       | 1120      | 2400x1792     | 1120      | 4800x3584      | 2000      |
| **4:5**      | 928x1152       | 1120      | 1856x2304     | 1120      | 3712x4608      | 2000      |
| **5:4**      | 1152x928       | 1120      | 2304x1856     | 1120      | 4608x3712      | 2000      |
| **9:16**     | 768x1376       | 1120      | 1536x2752     | 1120      | 3072x5504      | 2000      |
| **16:9**     | 1376x768       | 1120      | 2752x1536     | 1120      | 5504x3072      | 2000      |
| **21:9**     | 1584x672       | 1120      | 3168x1344     | 1120      | 6336x2688      | 2000      |

### Configuration Options

**imageSize:** `"1K"`, `"2K"`, or `"4K"` (default: `"1K"`)

**aspectRatio:** One of the supported ratios listed above

### Example Configuration

```json
{
  "generationConfig": {
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "2K"
    }
  }
}
```

## Response Format

The API returns a response with the following structure:

```json
{
  "candidates": [{
    "content": {
      "parts": [
        {
          "text": "Optional text description",
          "inlineData": {
            "mimeType": "image/png",
            "data": "base64_encoded_image_data"
          }
        }
      ]
    }
  }]
}
```

## Key Features

### 1. Thinking Process
Nano Banana Pro uses a default "Thinking" process that refines composition before generation, resulting in higher quality outputs.

### 2. Real-World Grounding
The model can use Google Search to ground its understanding in real-world context.

### 3. High-Fidelity Text Rendering
Unlike many image generation models, Nano Banana Pro can render text within images with high fidelity.

### 4. Multi-Resolution Support
Choose from 1K, 2K, or 4K resolutions depending on your needs.

## Use Cases

- **Professional Asset Production:** High-quality images for marketing, design, and media
- **Complex Instructions:** Scenarios requiring advanced reasoning and composition
- **Text-in-Image:** When you need readable text rendered within images
- **High-Resolution Outputs:** When 4K quality is required

## Best Practices

1. **Be Specific:** Provide detailed prompts for best results
2. **Use Appropriate Resolution:** Choose 1K for speed, 2K for balance, 4K for maximum quality
3. **Leverage Thinking:** The model's thinking process handles complex compositions automatically
4. **Reference Images:** Use image editing mode for consistency and iteration
5. **Aspect Ratio:** Select the aspect ratio that matches your use case

## Error Handling

Always check for errors in the response:

```python
if response.candidates[0].finish_reason == "SAFETY":
    print("Content was blocked due to safety filters")
elif response.candidates[0].finish_reason == "RECITATION":
    print("Content was blocked due to recitation")
```

## Rate Limits & Pricing

Refer to the [Gemini API pricing page](https://ai.google.dev/gemini-api/pricing) for current rate limits and pricing information.

## Additional Resources

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini Models Overview](https://ai.google.dev/gemini-api/docs/models/gemini)
- [API Cookbook](https://ai.google.dev/gemini-api/docs/cookbook)

---

**Last Updated:** 2026-01-11  
**Model Version:** gemini-3-pro-image-preview
