import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "path";

// Function to normalize file paths for Windows
function normalizeFilePath(filePath: string): string {
  // Remove /app/ prefix if present
  filePath = filePath.replace(/^\/app\//, '');
  
  // Convert forward slashes to backslashes for Windows
  filePath = filePath.replace(/\//g, '\\');
  
  // Remove any file:// prefix
  filePath = filePath.replace(/^file:\/\//, '');
  
  // Handle escaped paths (e.g., G:\\path -> G:\path)
  filePath = filePath.replace(/\\\\/g, '\\');
  
  return filePath;
}

// Function to ensure directory exists
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  const normalizedPath = normalizeFilePath(dirPath);
  if (!fs.existsSync(normalizedPath)) {
    fs.mkdirSync(normalizedPath, { recursive: true });
  }
}

const server = new Server({
  name: "gemini-image-gen",
  version: "1.1.0",
}, {
  capabilities: {
    tools: {}
  }
});

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "generate_images",
      description: "Generate images using Google Gemini AI",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { 
            type: "string",
            description: "Text description of the image to generate"
          },
          numberOfImages: { 
            type: "number",
            description: "Number of images to generate (1-4)",
            default: 1,
            minimum: 1,
            maximum: 4
          },
          outputDir: {
            type: "string",
            description: "Directory to save generated images",
            default: "G:\\image-gen3-google-mcp-server\\images"
          },
          subDir: {
            type: "string",
            description: "Subdirectory within outputDir to save images",
            default: ""
          }
        },
        required: ["prompt"]
      }
    },
    {
      name: "create_image_html",
      description: "Create HTML img tags from image file paths",
      inputSchema: {
        type: "object",
        properties: {
          imagePaths: {
            type: "array",
            items: { type: "string" },
            description: "Array of image file paths"
          },
          width: {
            type: "number",
            description: "Image width in pixels",
            default: 512
          },
          height: {
            type: "number",
            description: "Image height in pixels",
            default: 512
          }
        },
        required: ["imagePaths"]
      }
    }]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "generate_images") {
    try {
      const args = request.params.arguments as {
        prompt: string;
        numberOfImages?: number;
        outputDir?: string;
        subDir?: string;
      };
      const { 
        prompt, 
        numberOfImages = 1, 
        outputDir = "G:\\image-gen3-google-mcp-server\\images",
        subDir = ""
      } = args;
      
      // Ensure output directory exists
      const baseDir = normalizeFilePath(outputDir);
      const fullOutputDir = subDir ? path.join(baseDir, subDir) : baseDir;
      await ensureDirectoryExists(fullOutputDir);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: numberOfImages,
        },
      });

      if (!response.generatedImages) {
        throw new McpError(2, "No images were generated");
      }
      
      const generatedFiles: string[] = [];
      let idx = 1;
      
      // Get timestamp for unique filenames
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      for (const generatedImage of response.generatedImages) {
        if (!generatedImage.image?.imageBytes) {
          console.warn(`Image ${idx} has no image data, skipping`);
          continue;
        }
        const imgBytes = generatedImage.image.imageBytes;
        const buffer = Buffer.from(imgBytes, "base64");
        
        // Create filename with timestamp and sanitized prompt
        const sanitizedPrompt = prompt.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
        const filename = path.join(
          fullOutputDir,
          `${sanitizedPrompt}-${timestamp}-${idx}.png`
        );
        
        fs.writeFileSync(filename, buffer);
        generatedFiles.push(filename);
        idx++;
      }

      return {
        toolResult: {
          message: `Successfully generated ${generatedFiles.length} images`,
          files: generatedFiles
        }
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new McpError(2, `Failed to generate images: ${errMsg}`);
    }
  }

  if (request.params.name === "create_image_html") {
    try {
      const args = request.params.arguments as {
        imagePaths: string[];
        width?: number;
        height?: number;
      };
      const { imagePaths, width = 512, height = 512 } = args;

      const htmlTags = imagePaths.map(imagePath => {
        // Normalize the path for Windows
        const normalizedPath = normalizeFilePath(imagePath);
        return `<img src="file://${normalizedPath}" width="${width}" height="${height}" alt="Generated image" style="margin: 10px;" />`;
      });

      return {
        toolResult: {
          html: htmlTags.join('\n'),
          message: `Created HTML tags for ${imagePaths.length} images`
        }
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new McpError(2, `Failed to create HTML: ${errMsg}`);
    }
  }
  
  throw new McpError(1, "Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport); 