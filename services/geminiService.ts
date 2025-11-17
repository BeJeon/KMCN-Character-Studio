// Copyright (c) 2025 BeJeon. All Rights Reserved.
// Created by BeJeon, the original creator of KMCN Character Studio.

/*
  저작권 보호 기술에 대한 참고 사항 (NOTE ON COPYRIGHT PROTECTION TECHNOLOGIES):
  창작자의 요청에 따라, 생성된 자산을 보호하기 위한 다양한 기술적 조치들이 고려되었습니다.
  다음은 저작권을 보호하고 소유권을 주장하는 데 사용될 수 있는 주요 기술 및 방법입니다.

  - 워터마크 (Watermark):
    가장 흔히 사용되는 방법으로, 이미지나 영상 위에 로고, 텍스트, 서명 등을 눈에 보이게 또는 보이지 않게 삽입하는 것입니다.
    이는 저작권 정보를 제공하고 무단 사용을 막는 데 도움을 줍니다.

  - 디지털 워터마킹 (Digital Watermarking):
    일반적인 워터마크보다 더 발전된 기술로, 디지털 콘텐츠에 사람의 지각으로는 감지하기 어려운 방식으로 저작권 정보를 내장하는 기술입니다.
    콘텐츠가 불법 복제되어도 삽입된 정보를 통해 원본 여부나 저작권자를 식별할 수 있습니다.
    (본 스튜디오에서는 'BeJeon' 이스터에그를 이 기술로 삽입하여, 육안으로는 보이지 않게 저작권을 보호합니다.)

  - DRM (Digital Rights Management, 디지털 저작권 관리):
    디지털 콘텐츠의 무단 복제 및 사용을 막기 위해 접근 제어 기술을 포함한 다양한 기술과 서비스를 통틀어 일컫는 말입니다.
    콘텐츠가 암호화하고 허가된 사용자만 접근할 수 있도록 라이선스를 발급하는 방식 등이 포함됩니다.

  - 핑거프린팅 (Fingerprinting):
    콘텐츠를 유통할 때 사용자별로 고유한 식별 정보를 삽입하여, 불법 유출 시 최초 유출자를 추적할 수 있도록 하는 기술입니다.
    이는 도용 방지보다는 사후 추적에 중점을 둡니다.
    (본 스튜디오에서는 이 기술을 활용하여, 일반 사용자가 생성한 이미지에 해당 사용자 이름을 보이지 않게 삽입하여 추적성을 강화합니다.)

  이러한 기술 및 방법을 사용하여 자신의 저작권(Copyright)을 보호하고 소유권을 주장할 수 있습니다.
  코드의 경우, 소스코드 내에 주석(comments) 형태로 저작권 정보를 명시하는 것도 일반적인 방법 중 하나입니다.
*/

import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you'd want to handle this more gracefully,
  // but for this environment we assume it's set.
  console.error("API_KEY is not defined in environment variables. Please set it.");
}

/**
 * Optimizes an image before sending to Gemini API.
 * Resizes images larger than 1536px down to 1536px on their longest side to speed up transfer and processing.
 */
async function optimizeImage(base64Data: string, mimeType: string, maxWidthHeight: number = 1536): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width <= maxWidthHeight && height <= maxWidthHeight) {
                resolve(base64Data); // No need to resize
                return;
            }

            if (width > height) {
                height = Math.round((height * maxWidthHeight) / width);
                width = maxWidthHeight;
            } else {
                width = Math.round((width * maxWidthHeight) / height);
                height = maxWidthHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                 resolve(base64Data); // Fallback to original if canvas fails
                 return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Use standard quality 0.9 to further optimize size while maintaining good visual quality for AI
            const newDataUrl = canvas.toDataURL(mimeType, 0.9);
            resolve(newDataUrl.split(',')[1]);
        };
        img.onerror = () => {
            console.warn("Failed to optimize image, using original.");
            resolve(base64Data);
        };
        img.src = `data:${mimeType};base64,${base64Data}`;
    });
}

/**
 * Embeds invisible data into an image using LSB steganography.
 * @param base64Data The base64 string of the image.
 * @param mimeType The MIME type of the image.
 * @param text The text to embed.
 * @returns A promise that resolves with the new base64 string of the image with embedded data.
 */
async function embedInvisibleWatermark(base64Data: string, mimeType: string, text: string): Promise<string> {
    // Using a terminator to know where the message ends when decoding.
    const terminator = "||END||";
    const textToEmbed = text + terminator;
    let binaryString = '';
    for (let i = 0; i < textToEmbed.length; i++) {
        binaryString += textToEmbed[i].charCodeAt(0).toString(2).padStart(8, '0');
    }

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            // Use willReadFrequently for performance gain on repeated getImageData calls
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas context is not available for watermarking.'));

            ctx.drawImage(image, 0, 0);

            // OPTIMIZATION: Only read necessary rows to speed up processing
            // We store 3 bits per pixel (R, G, B).
            const neededPixels = Math.ceil(binaryString.length / 3);
            // Add a small buffer row to be safe and simple. Ensure we don't exceed image height.
            const rowsToRead = Math.min(image.naturalHeight, Math.ceil(neededPixels / canvas.width) + 1);

            const imageData = ctx.getImageData(0, 0, canvas.width, rowsToRead);
            const data = imageData.data;

            // Ensure there's enough space in the read area to hold the data
            if (binaryString.length > (data.length / 4) * 3) {
                 // This case should be covered by the rowsToRead calculation, but as a fallback:
                 console.warn('Calculated read area is too small, falling back to full image read.');
                 // Fallback to full read if our optimization math was somehow off for weird aspect ratios
                 const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 if (binaryString.length > (fullImageData.data.length / 4) * 3) {
                     console.warn('Image is too small to hold the invisible watermark. Skipping.');
                     resolve(base64Data);
                     return;
                 }
                 // If full image works, use it (slow path but safe)
                 embedIntoData(fullImageData.data, binaryString);
                 ctx.putImageData(fullImageData, 0, 0);
            } else {
                // Optimized path
                embedIntoData(data, binaryString);
                ctx.putImageData(imageData, 0, 0);
            }

            // Use PNG to ensure the LSB modifications are not lost to compression
            const newDataUrl = canvas.toDataURL('image/png');
            const [, newBase64] = newDataUrl.split(',');
            resolve(newBase64);
        };
        image.onerror = (err) => reject(new Error(`Failed to load image for invisible watermarking: ${err}`));
        image.src = `data:${mimeType};base64,${base64Data}`;
    });
}

// Helper function for embedding logic to avoid duplication in fallback
function embedIntoData(data: Uint8ClampedArray, binaryString: string) {
    let dataIndex = 0;
    for (let i = 0; i < binaryString.length; i++) {
        // Skip the alpha channel which is every 4th value
        if ((dataIndex + 1) % 4 === 0) {
            dataIndex++;
        }
        if (dataIndex >= data.length) break;

        const bit = parseInt(binaryString[i], 10);
        if (bit === 1) {
            data[dataIndex] = data[dataIndex] | 1; // Set the LSB to 1
        } else {
            data[dataIndex] = data[dataIndex] & ~1; // Set the LSB to 0
        }
        dataIndex++;
    }
}

/**
 * Processes a generated image by applying an invisible watermark (digital fingerprint).
 * @param base64Data The raw base64 data from the generation model.
 * @param mimeType The MIME type of the raw image.
 * @returns A promise that resolves with the processed image data.
 */
async function processGeneratedImage(base64Data: string, mimeType: string): Promise<{ base64Data: string, mimeType: string }> {
    try {
        const isCreator = sessionStorage.getItem('isCreator') === 'true';
        const userName = sessionStorage.getItem('loggedInUser');

        // Embed the username for non-creator users for tracking purposes.
        // Embed the "BeJeon" Easter Egg for the creator.
        const textToEmbed = !isCreator && userName ? userName : "BeJeon";
        
        const invisiblyWatermarkedBase64 = await embedInvisibleWatermark(base64Data, mimeType, textToEmbed);
        
        // The output mimeType must be PNG to preserve the lossless LSB data.
        return { base64Data: invisiblyWatermarkedBase64, mimeType: 'image/png' };

    } catch (e) {
        console.error("An error occurred during invisible watermarking. Returning original image as a fallback.", e);
        // If watermarking fails, return the original, unwatermarked image to avoid breaking the flow.
        return { base64Data, mimeType };
    }
}

function binaryToText(binary: string): string {
    let text = '';
    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.substring(i, i + 8);
        if (byte.length === 8) {
            text += String.fromCharCode(parseInt(byte, 2));
        }
    }
    return text;
}

/**
 * Decodes invisible data from an image using LSB steganography.
 * @param base64Data The base64 string of the image.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves with the decoded text, or null if no message is found.
 */
export async function decodeInvisibleWatermark(base64Data: string, mimeType: string): Promise<string | null> {
    const terminator = "||END||";
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas context is not available for decoding.'));

            ctx.drawImage(image, 0, 0);
            
            // Optimization: Read a reasonable chunk first, most watermarks are at the top.
            // 50 rows should be enough for even very long usernames.
            const initialRows = Math.min(50, canvas.height);
            let imageData = ctx.getImageData(0, 0, canvas.width, initialRows);
            let data = imageData.data;

            let binaryString = '';
            let dataIndex = 0;
            let found = false;
            
            // Helper to process data and check for terminator
            const processData = (pixelData: Uint8ClampedArray) => {
                 while (dataIndex < pixelData.length) {
                    // Skip alpha channel
                    if ((dataIndex + 1) % 4 === 0) {
                        dataIndex++;
                        if (dataIndex >= pixelData.length) break;
                    }

                    const lsb = pixelData[dataIndex] & 1;
                    binaryString += lsb.toString();
                    
                    // Once we have enough bits for a character, check for the terminator
                    if (binaryString.length % 8 === 0) {
                        const decodedText = binaryToText(binaryString);
                        const terminatorIndex = decodedText.indexOf(terminator);
                        if (terminatorIndex !== -1) {
                            return decodedText.substring(0, terminatorIndex);
                        }
                    }
                    dataIndex++;
                }
                return null;
            }

            let result = processData(data);
            if (result !== null) {
                resolve(result);
                return;
            }

            // If not found in initial chunk, read the rest (rare case fallback)
            if (initialRows < canvas.height) {
                 // We need to continue from where we left off, but it's simpler to just read the whole thing
                 // if the optimized read failed, resetting indices.
                 // A more complex implementation would continue reading chunks.
                 // Given the use case, if it's not in the first 50 rows, it's probably not there or something is wrong,
                 // but for completeness we can try the full image.
                 const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 // Reset and try again with full data
                 binaryString = '';
                 dataIndex = 0;
                 result = processData(fullImageData.data);
                 if (result !== null) {
                     resolve(result);
                     return;
                 }
            }
            
            resolve(null); // Terminator not found
        };
        image.onerror = (err) => reject(new Error(`Failed to load image for decoding: ${err}`));
        image.src = `data:${mimeType};base64,${base64Data}`;
    });
}


const NO_TEXT_RULE = `
**Primary Rule: No Text**
- It is crucial that the final image contains no text, letters, numbers, or symbols.
- The output should be a pure image containing only the described visual elements.
- Please verify before finishing that no text has been accidentally included. This is a critical requirement.`;

const NO_TEXT_REMINDER = `\n**Reminder:** The image must be completely free of any text.`;

const QUALITY_ENHANCEMENT_RULE = `
**Artistic Style: High-Quality Photorealism**
- **Goal:** Create a high-quality, photorealistic image with professional digital art standards.
- **Details:** Focus on realistic textures for hair, skin, and clothing.
- **Lighting:** Use dynamic, cinematic lighting with natural shadows and highlights to create depth.
- **Clarity:** Ensure the final image is sharp and high-resolution.`;

const ILLUSTRATIVE_STYLE_RULE = `
**Artistic Style: Polished Illustrative**
- **Goal:** Create a clean, vibrant illustrative style, similar to modern webtoons or concept art.
- **Characters:** Use clean lines, expressive features, and soft cell shading.
- **Colors:** Employ a bright, saturated, and harmonious color palette.
- **Lighting:** Use stylistic lighting with clear highlights and shadows to define form.
- **Clarity:** Ensure the final image is sharp, high-resolution, with a polished finish.`;


export async function generateExpressionImage(
  base64ImageData: string,
  mimeType: string,
  expressionPrompt: string,
  anglePrompt: string
): Promise<{ base64Data: string; mimeType: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    
    // Optimize input image size for speed
    const optimizedBase64 = await optimizeImage(base64ImageData, mimeType);

    const instructionText = `You are an AI image generator specializing in character art. Your task is to modify the provided character image according to the following instructions.

**1. Core Task:**
- Recreate the character with a new facial expression: "${expressionPrompt}".
- The expression must be dynamic, clear, and full of emotion.
- Render the character from this camera angle: "${anglePrompt}".

**2. Character Integrity:**
- You MUST maintain the character's original identity, core features, and art style. Do not change their fundamental appearance.

**3. Other Details:**
- The character should wear an outfit that is appropriate for the emotion being expressed.
- Use a simple, neutral background that doesn't distract from the character.

${QUALITY_ENHANCEMENT_RULE}
${NO_TEXT_RULE}
${NO_TEXT_REMINDER}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [
          { text: instructionText },
          {
            inlineData: {
              data: optimizedBase64,
              mimeType: mimeType,
            },
          },
        ],
      }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
        throw new Error(`이미지 생성이 프롬프트 안전 문제로 차단되었습니다: ${response.promptFeedback.blockReason}. 프롬프트를 수정하고 다시 시도해 주세요.`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new Error("모델이 응답을 생성하지 않았습니다. 프롬프트나 설정에 문제가 있을 수 있습니다. 안전 필터에 의해 차단되었을 수 있습니다.");
    }

    const imagePart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imagePart?.inlineData) {
        return await processGeneratedImage(imagePart.inlineData.data, imagePart.inlineData.mimeType);
    }
    
    // If no image, analyze the finish reason for a more specific error message
    const { finishReason, safetyRatings } = candidate;

    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
        const safetyIssues = safetyRatings
            ?.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map(r => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
        const detailedReason = safetyIssues ? `분류: ${safetyIssues}` : '자세한 사유는 제공되지 않았습니다. 입력 이미지나 프롬프트를 확인해 주세요.';
        throw new Error(`이미지 생성이 콘텐츠 안전 문제로 중단되었습니다. ${detailedReason}`);
    }
    
    if (finishReason === 'IMAGE_OTHER') {
         throw new Error('모델이 이미지를 생성할 수 없습니다. 이는 프롬프트가 너무 복잡하거나, 지원되지 않는 요소를 포함했기 때문일 수 있습니다. 프롬프트를 단순화하여 다시 시도해 주세요.');
    }
    
    if (finishReason === 'NO_IMAGE') {
        throw new Error('모델이 이미지를 생성하지 않았습니다. 이는 입력된 이미지나 프롬프트의 내용(예: 특정 인물, 저작권 요소 등)을 처리할 수 없거나, 요청이 명확하지 않기 때문일 수 있습니다. 다른 이미지를 사용하거나 프롬프트를 수정해 보세요.');
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`모델이 이미지를 생성하지 못했습니다. 모델 응답: "${textResponse}"`);
    }

    throw new Error(`응답에서 이미지를 찾을 수 없습니다. (종료 이유: ${finishReason || '알 수 없음'})`);
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    throw new Error("표정 생성에 실패했습니다. 모델이 이 요청을 처리할 수 없습니다. 다시 시도해 주세요.");
  }
}


export async function generateSceneImage(
  characterImages: Array<{ data: string; mimeType: string }>,
  prompt: string,
  backgroundPrompt: string,
  clothingPrompt: string,
  artStyle: 'gemini' | 'illustrative',
  shouldChangeArtStyle: boolean,
  compositionRefs?: Array<{ data: string; mimeType: string }> | null,
  poseRefs?: Array<{ data: string; mimeType: string }> | null,
  dimensions?: { width: number; height: number; } | null,
  cameraAnglePrompt?: string | null
): Promise<{ base64Data: string; mimeType: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });

    const characterIntegrityRule = shouldChangeArtStyle
        ? `- **Style Override:** The 'Required Style' below is mandatory. You must redraw the provided characters in this new style, preserving their core identity (face, hair) but discarding their original art style.`
        : `- **Style Preservation:** You must perfectly preserve the identity, facial features, hairstyle, AND THE ORIGINAL ART STYLE of each character from their source image. Do not alter their drawing style.`;
    
    const backgroundInstruction = backgroundPrompt.trim()
      ? `Create a new, detailed background from this description: "${backgroundPrompt.trim()}"`
      : 'Preserve and seamlessly blend the backgrounds from the original character images.';

    const clothingInstruction = clothingPrompt.trim()
      ? `Create new clothing for the characters from this description: "${clothingPrompt.trim()}"`
      : 'Preserve the original clothing worn by each character.';

    let instructionText = `**Task:** Generate a single, cohesive, high-quality image based on the provided instructions and reference images.

**Scene Description:**
Create a scene that depicts: "${prompt}"

**Core Instructions**

**1. Characters:**
- Use only the characters from the provided source images.
${characterIntegrityRule}
- Position them with natural expressions and actions suitable for the scene.

**2. Background:**
- **Instruction:** ${backgroundInstruction}

**3. Clothing:**
- **Instruction:** ${clothingInstruction}

**Artistic & Compositional Direction**

**1. Camera Perspective:**
- Render the entire scene from this camera angle: **${cameraAnglePrompt || 'AI-determined best angle for the scene'}**.

**2. Art Style:**
- **Required Style:** ${artStyle === 'illustrative' ? 'Illustrative / Webtoon Style' : 'High-Quality Photorealistic Style'}.
- Follow these style guidelines precisely:
${artStyle === 'illustrative' ? ILLUSTRATIVE_STYLE_RULE : QUALITY_ENHANCEMENT_RULE}
`;

    if (compositionRefs && compositionRefs.length > 0) {
        instructionText += `
**3. Composition Reference (Inspiration Only):**
- Use the provided composition reference image(s) for layout and positioning inspiration.
- **Do not copy** characters, faces, or specific objects from these references. They are for layout ideas only.
`;
    }
    
    if (poseRefs && poseRefs.length > 0) {
        instructionText += `
**4. Pose/Action Reference (Inspiration Only):**
- Use the provided pose/action reference image(s) for posing inspiration.
- **Do not copy** characters, faces, or specific objects from these references. They are for posing ideas only.
`;
    }

    if (dimensions) {
        instructionText += `
**5. Image Dimensions:**
- The final image resolution MUST be exactly ${dimensions.width}px wide and ${dimensions.height}px high.
`;
    }

    instructionText += `
${NO_TEXT_RULE}
${NO_TEXT_REMINDER}
`;

    const allParts: Array<{ inlineData: { data: string; mimeType: string; }; }> = [];
    
    // Optimize all input images for speed
    for (const img of characterImages) {
        const optimizedData = await optimizeImage(img.data, img.mimeType);
        allParts.push({ inlineData: { data: optimizedData, mimeType: img.mimeType }});
    }
    if (compositionRefs) {
        for (const ref of compositionRefs) {
             const optimizedData = await optimizeImage(ref.data, ref.mimeType);
             allParts.push({ inlineData: { data: optimizedData, mimeType: ref.mimeType }});
        }
    }
    if (poseRefs) {
         for (const ref of poseRefs) {
             const optimizedData = await optimizeImage(ref.data, ref.mimeType);
             allParts.push({ inlineData: { data: optimizedData, mimeType: ref.mimeType }});
        }
    }

    const textPart = { text: instructionText };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [textPart, ...allParts],
      }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
        throw new Error(`이미지 생성이 프롬프트 안전 문제로 차단되었습니다: ${response.promptFeedback.blockReason}. 프롬프트를 수정하고 다시 시도해 주세요.`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new Error("모델이 응답을 생성하지 않았습니다. 프롬프트나 설정에 문제가 있을 수 있습니다. 안전 필터에 의해 차단되었을 수 있습니다.");
    }

    const imagePart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imagePart?.inlineData) {
        return await processGeneratedImage(imagePart.inlineData.data, imagePart.inlineData.mimeType);
    }
    
    // If no image, analyze the finish reason for a more specific error message
    const { finishReason, safetyRatings } = candidate;

    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
        const safetyIssues = safetyRatings
            ?.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map(r => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
        const detailedReason = safetyIssues ? `분류: ${safetyIssues}` : '자세한 사유는 제공되지 않았습니다. 입력 이미지나 프롬프트를 확인해 주세요.';
        throw new Error(`이미지 생성이 콘텐츠 안전 문제로 중단되었습니다. ${detailedReason}`);
    }
    
    if (finishReason === 'IMAGE_OTHER') {
         throw new Error('모델이 이미지를 생성할 수 없습니다. 이는 프롬프트가 너무 복잡하거나, 지원되지 않는 요소를 포함했기 때문일 수 있습니다. 프롬프트를 단순화하여 다시 시도해 주세요.');
    }
    
    if (finishReason === 'NO_IMAGE') {
        throw new Error('모델이 이미지를 생성하지 않았습니다. 이는 입력된 이미지나 프롬프트의 내용(예: 특정 인물, 저작권 요소 등)을 처리할 수 없거나, 요청이 명확하지 않기 때문일 수 있습니다. 다른 이미지를 사용하거나 프롬프트를 수정해 보세요.');
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`모델이 이미지를 생성하지 못했습니다. 모델 응답: "${textResponse}"`);
    }

    throw new Error(`응답에서 이미지를 찾을 수 없습니다. (종료 이유: ${finishReason || '알 수 없음'})`);
  } catch (error) {
    console.error("Error generating scene with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    throw new Error("장면 생성에 실패했습니다. 모델이 이 요청을 처리할 수 없습니다. 다시 시도해 주세요.");
  }
}

export async function generateCameraAngleImage(
  base64ImageData: string,
  mimeType: string,
  anglePrompt: string
): Promise<{ base64Data: string; mimeType: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    
    // Optimize input image size for speed
    const optimizedBase64 = await optimizeImage(base64ImageData, mimeType);

    const instructionText = `You are an AI image transformation specialist. Your task is to redraw the provided character image from a new camera angle.

**1. Primary Goal: Change Camera Angle**
- Your single most important task is to re-render the character from this perspective: "${anglePrompt}".
- You MUST redraw the character's pose, lighting, and shadows to be physically accurate from the new viewpoint. Do not just copy the original pose.

**2. Strict Preservation Rules:**
- **Identity:** You MUST preserve the character's exact facial features, hairstyle, clothing, and art style.
- **Expression:** You MUST maintain the character's original facial expression perfectly.

**3. Background:**
- Use a simple, neutral background (like a soft gray gradient) to keep the focus on the character.

${QUALITY_ENHANCEMENT_RULE}
${NO_TEXT_RULE}
${NO_TEXT_REMINDER}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [
          { text: instructionText },
          {
            inlineData: {
              data: optimizedBase64,
              mimeType: mimeType,
            },
          },
        ],
      }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
        throw new Error(`이미지 생성이 프롬프트 안전 문제로 차단되었습니다: ${response.promptFeedback.blockReason}. 프롬프트를 수정하고 다시 시도해 주세요.`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new Error("모델이 응답을 생성하지 않았습니다. 프롬프트나 설정에 문제가 있을 수 있습니다. 안전 필터에 의해 차단되었을 수 있습니다.");
    }

    const imagePart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imagePart?.inlineData) {
        return await processGeneratedImage(imagePart.inlineData.data, imagePart.inlineData.mimeType);
    }
    
    // If no image, analyze the finish reason for a more specific error message
    const { finishReason, safetyRatings } = candidate;

    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
        const safetyIssues = safetyRatings
            ?.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map(r => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
        const detailedReason = safetyIssues ? `분류: ${safetyIssues}` : '자세한 사유는 제공되지 않았습니다. 입력 이미지나 프롬프트를 확인해 주세요.';
        throw new Error(`이미지 생성이 콘텐츠 안전 문제로 중단되었습니다. ${detailedReason}`);
    }
    
    if (finishReason === 'IMAGE_OTHER') {
         throw new Error('모델이 이미지를 생성할 수 없습니다. 이는 프롬프트가 너무 복잡하거나, 지원되지 않는 요소를 포함했기 때문일 수 있습니다. 프롬프트를 단순화하여 다시 시도해 주세요.');
    }
    
    if (finishReason === 'NO_IMAGE') {
        throw new Error('모델이 이미지를 생성하지 않았습니다. 이는 입력된 이미지나 프롬프트의 내용(예: 특정 인물, 저작권 요소 등)을 처리할 수 없거나, 요청이 명확하지 않기 때문일 수 있습니다. 다른 이미지를 사용하거나 프롬프트를 수정해 보세요.');
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`모델이 이미지를 생성하지 못했습니다. 모델 응답: "${textResponse}"`);
    }

    throw new Error(`응답에서 이미지를 찾을 수 없습니다. (종료 이유: ${finishReason || '알 수 없음'})`);
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    throw new Error("이미지 생성에 실패했습니다. 모델이 이 요청을 처리할 수 없습니다. 다시 시도해 주세요.");
  }
}

export async function extendImage(
  base64ImageData: string,
  mimeType: string,
  aspectRatio: '9:16' | '16:9'
): Promise<{ base64Data: string; mimeType: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });

    const instructionText = `
**Primary Goal: Photorealistic Image Outpainting (Image Extension)**
You are an AI digital artist specializing in photorealistic outpainting. An image has been placed on a larger, transparent canvas. Your task is to fill ONLY the transparent areas.

**Critical Task:**
1.  **Fill Transparent Areas:** Intelligently and creatively extend the central image into the surrounding transparent space. The final output MUST be a single, complete, and seamless image with no transparency.
2.  **Logical Continuation:** The new areas must be a logical and natural continuation of the existing image content. Analyze the lighting, textures, perspective, and subject matter to create a believable extension.
3.  **Flawless Integration:** The seams between the original image and the generated areas must be completely invisible. Match the color palette, lighting, shadows, and overall style perfectly.

**Strict Prohibitions (Critical Failure Conditions):**
-   **ABSOLUTELY NO Black Bars:** Do not fill the transparent areas with black bars, solid colors, or simple gradients. This is an explicit failure.
-   **Do NOT Alter the Original:** The original, non-transparent part of the image MUST remain completely untouched and unmodified.
-   **No Text or Logos:** Do not add any text, watermarks, or logos.

${QUALITY_ENHANCEMENT_RULE}

Treat this as a professional photo restoration and extension task. The result should look like it was a single photograph from the beginning.
`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [
          { text: instructionText },
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
        ],
      }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
        throw new Error(`이미지 생성이 프롬프트 안전 문제로 차단되었습니다: ${response.promptFeedback.blockReason}. 프롬프트를 수정하고 다시 시도해 주세요.`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new Error("모델이 응답을 생성하지 않았습니다. 프롬프트나 설정에 문제가 있을 수 있습니다. 안전 필터에 의해 차단되었을 수 있습니다.");
    }

    const imagePart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imagePart?.inlineData) {
        return await processGeneratedImage(imagePart.inlineData.data, imagePart.inlineData.mimeType);
    }
    
    // If no image, analyze the finish reason for a more specific error message
    const { finishReason, safetyRatings } = candidate;

    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
        const safetyIssues = safetyRatings
            ?.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map(r => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
        const detailedReason = safetyIssues ? `분류: ${safetyIssues}` : '자세한 사유는 제공되지 않았습니다. 입력 이미지나 프롬프트를 확인해 주세요.';
        throw new Error(`이미지 생성이 콘텐츠 안전 문제로 중단되었습니다. ${detailedReason}`);
    }
    
    if (finishReason === 'IMAGE_OTHER') {
         throw new Error('모델이 이미지를 생성할 수 없습니다. 이는 프롬프트가 너무 복잡하거나, 지원되지 않는 요소를 포함했기 때문일 수 있습니다. 프롬프트를 단순화하여 다시 시도해 주세요.');
    }
    
    if (finishReason === 'NO_IMAGE') {
        throw new Error('모델이 이미지를 생성하지 않았습니다. 이는 입력된 이미지나 프롬프트의 내용(예: 특정 인물, 저작권 요소 등)을 처리할 수 없거나, 요청이 명확하지 않기 때문일 수 있습니다. 다른 이미지를 사용하거나 프롬프트를 수정해 보세요.');
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`모델이 이미지를 생성하지 못했습니다. 모델 응답: "${textResponse}"`);
    }

    throw new Error(`응답에서 이미지를 찾을 수 없습니다. (종료 이유: ${finishReason || '알 수 없음'})`);
  } catch (error) {
    console.error("Error extending image with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    throw new Error("이미지 확장에 실패했습니다. 모델이 이 요청을 처리할 수 없습니다. 다시 시도해 주세요.");
  }
}

export async function mergeWithPerspective(
  targetImage: { data: string; mimeType: string },
  inspirationImage: { data: string; mimeType: string },
  maskImage: { data: string; mimeType: string }
): Promise<{ base64Data: string; mimeType: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    
    // Optimize input images for speed
    const optimizedTarget = await optimizeImage(targetImage.data, targetImage.mimeType);
    const optimizedInspiration = await optimizeImage(inspirationImage.data, inspirationImage.mimeType);
    // Mask doesn't need deep optimization, but good to be consistent in size if target was resized. 
    // Actually mask must match target size. Let's assume mask is generated from target's current display size which should match.
    // If we optimized target, we should strictly optimize mask to same dimension if we had a robust way, 
    // but mask is usually small enough or generated on the fly.
    // For now let's just optimize the heavy photographic inputs.

    const instructionText = `
**Task: Perspective Banner Inpainting**
Your task is to perform an inpainting operation using three provided images.

**Image Roles:**
- **FIRST IMAGE (TARGET):** The main scene.
- **SECOND IMAGE (INSPIRATION):** Contains a banner/sign to be extracted.
- **THIRD IMAGE (MASK):** A black and white image. The WHITE area indicates the exact location on the TARGET IMAGE to place the banner.

**Objective:**
- Take the banner from the INSPIRATION IMAGE and place it onto the TARGET IMAGE within the white area of the MASK. The final result should be a single, photorealistic image.

**Integration Rules:**
- **Perspective & Angle:** Warp and transform the banner to perfectly match the perspective and camera angle of the target scene.
- **Lighting & Shadows:** Seamlessly blend the banner's lighting and shadows with the target image.
- **Color & Tone:** Match the color grading and tone of the target image.
- **Depth & Focus:** The banner must have the correct depth of field (e.g., be blurry if the background is blurry).
- **Seamless Blending:** The edges of the banner must blend naturally with the background.
- **Preserve Target:** Do not change anything in the TARGET IMAGE outside of the masked area.

**Text Rule:**
- The text from the original banner should be included.
- **Do not** add any new text, watermarks, or signatures.

${QUALITY_ENHANCEMENT_RULE}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [
          { text: instructionText },
          { inlineData: { data: optimizedTarget, mimeType: targetImage.mimeType } },
          { inlineData: { data: optimizedInspiration, mimeType: inspirationImage.mimeType } },
          { inlineData: { data: maskImage.data, mimeType: maskImage.mimeType } },
        ],
      }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
        throw new Error(`이미지 생성이 프롬프트 안전 문제로 차단되었습니다: ${response.promptFeedback.blockReason}. 프롬프트를 수정하고 다시 시도해 주세요.`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new Error("모델이 응답을 생성하지 않았습니다. 프롬프트나 설정에 문제가 있을 수 있습니다. 안전 필터에 의해 차단되었을 수 있습니다.");
    }

    const imagePart = candidate.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imagePart?.inlineData) {
        return await processGeneratedImage(imagePart.inlineData.data, imagePart.inlineData.mimeType);
    }
    
    // If no image, analyze the finish reason for a more specific error message
    const { finishReason, safetyRatings } = candidate;

    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
        const safetyIssues = safetyRatings
            ?.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map(r => r.category.replace('HARM_CATEGORY_', ''))
            .join(', ');
        const detailedReason = safetyIssues ? `분류: ${safetyIssues}` : '자세한 사유는 제공되지 않았습니다. 입력 이미지나 프롬프트를 확인해 주세요.';
        throw new Error(`이미지 생성이 콘텐츠 안전 문제로 중단되었습니다. ${detailedReason}`);
    }
    
    if (finishReason === 'IMAGE_OTHER') {
         throw new Error('모델이 이미지를 생성할 수 없습니다. 이는 프롬프트가 너무 복잡하거나, 지원되지 않는 요소를 포함했기 때문일 수 있습니다. 프롬프트를 단순화하여 다시 시도해 주세요.');
    }
    
    if (finishReason === 'NO_IMAGE') {
        throw new Error('모델이 이미지를 생성하지 않았습니다. 이는 입력된 이미지나 프롬프트의 내용(예: 특정 인물, 저작권 요소 등)을 처리할 수 없거나, 요청이 명확하지 않기 때문일 수 있습니다. 다른 이미지를 사용하거나 프롬프트를 수정해 보세요.');
    }
    
    const textResponse = response.text?.trim();
    if (textResponse) {
        throw new Error(`모델이 이미지를 생성하지 못했습니다. 모델 응답: "${textResponse}"`);
    }

    throw new Error(`응답에서 이미지를 찾을 수 없습니다. (종료 이유: ${finishReason || '알 수 없음'})`);
  } catch (error) {
    console.error("Error merging image with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    throw new Error("이미지 합성에 실패했습니다. 모델이 이 요청을 처리할 수 없습니다. 다시 시도해 주세요.");
  }
}

export async function generateSceneSuggestion(
  mainPrompt: string,
  suggestionType: 'background' | 'clothing'
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });

    const typeDescription = suggestionType === 'background'
        ? '상세하고 창의적인 배경'
        : '캐릭터에 어울리는 창의적인 의상 스타일';

    const instructionText = `다음 장면 설명을 기반으로, AI 이미지 생성기에 사용하기 적합한 ${typeDescription}을(를) 한국어로 제안해주세요.
    
Scene: "${mainPrompt}"

규칙:
- 창의적이고 구체적으로 작성하되, **너무 길지 않게 핵심만 간결하게 표현해주세요 (권장: 100자 이내).**
- "배경:", "의상:" 같은 접두사나 부가적인 설명 없이, 제안하는 문구 자체만 응답해야 합니다.
- **반드시 한국어로 응답해야 합니다.**
- 적절한 제안이 떠오르지 않더라도 장면과 어울리는 일반적인 설명을 반드시 포함하세요. 빈 응답을 보내지 마세요.

배경 예시: "신비로운 버섯과 고대 나무가 빛나는 황혼의 숲"
의상 예시: "섬세한 레이스 디테일이 있는 우아한 빅토리아 시대 무도회 가운"

제안:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: instructionText,
      config: {
          maxOutputTokens: 2048, // Increased further to prevent MAX_TOKENS error for detailed Korean suggestions
          temperature: 0.7,
      }
    });
    
    if (response.promptFeedback?.blockReason) {
         throw new Error(`AI 제안이 안전 정책에 의해 차단되었습니다 (${response.promptFeedback.blockReason}).`);
    }

    const text = response.text;
    if (typeof text !== 'string' || !text) {
         // Detailed error handling for missing text
         const candidate = response.candidates?.[0];
         if (candidate?.finishReason) {
              if (candidate.finishReason === 'SAFETY') throw new Error("AI 제안이 안전 문제로 중단되었습니다.");
              if (candidate.finishReason === 'RECITATION') throw new Error("AI 제안이 저작권 문제로 중단되었습니다.");
              if (candidate.finishReason === 'MAX_TOKENS') throw new Error("AI 제안이 너무 길어 중단되었습니다. 다시 시도해보세요.");
              if (candidate.finishReason !== 'STOP') throw new Error(`AI 제안 생성이 중단되었습니다 (사유: ${candidate.finishReason}).`);
         }
         throw new Error("모델이 유효한 응답을 반환하지 않았습니다. 잠시 후 다시 시도해주세요.");
    }

    // Clean up response, remove potential quotes or extra whitespace
    const suggestion = text.trim().replace(/^"|"$/g, '').replace(/^(배경|의상):\s*/, '');
    if (!suggestion) {
        throw new Error("모델이 빈 제안을 반환했습니다.");
    }

    return suggestion;

  } catch (error) {
    console.error(`Error generating ${suggestionType} suggestion:`, error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error("API 키가 유효하지 않습니다. 설정을 확인해 주세요.");
        }
        throw error; // Re-throw the more specific error from the try block
    }
    const typeName = suggestionType === 'background' ? '배경' : '의상';
    throw new Error(`${typeName} 제안 생성에 실패했습니다. 다시 시도해 주세요.`);
  }
}