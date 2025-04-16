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
import * as os from "os";

// Get the user's desktop path based on their OS
function getUserDesktopPath(): string {
  try {
    // Try to get the desktop path in a cross-platform way
    const userHomeDir = os.homedir();
    
    if (process.platform === 'win32') {
      // Windows: Use USERPROFILE environment variable or fallback to homedir
      return path.join(process.env.USERPROFILE || userHomeDir, 'Desktop');
    } else if (process.platform === 'darwin') {
      // macOS
      return path.join(userHomeDir, 'Desktop');
    } else {
      // Linux and others: Check XDG_DESKTOP_DIR first
      const xdgConfig = path.join(userHomeDir, '.config', 'user-dirs.dirs');
      if (fs.existsSync(xdgConfig)) {
        try {
          const config = fs.readFileSync(xdgConfig, 'utf-8');
          const match = config.match(/XDG_DESKTOP_DIR="(.+)"/);
          if (match) {
            return match[1].replace('$HOME', userHomeDir);
          }
        } catch (error) {
          console.warn('Could not read XDG config:', error);
        }
      }
      // Fallback to standard Desktop directory
      return path.join(userHomeDir, 'Desktop');
    }
  } catch (error) {
    console.warn('Error getting desktop path:', error);
    // Fallback to current directory if we can't determine desktop
    return process.cwd();
  }
}

// Get the storage location for generated images
function getImageStorageDir(): string {
  const desktopPath = getUserDesktopPath();
  const storageDir = path.join(desktopPath, 'AI-Generated-Images');
  
  // Log the directory being used
  console.log(`Storage directory for current OS (${process.platform}):`, storageDir);
  
  return storageDir;
}

// Function to normalize file paths for the current OS
function normalizeFilePath(filePath: string): string {
  // Remove common prefixes that might come from different environments
  filePath = filePath.replace(/^(\/app\/|\/root\/|\\root\\)/, '');
  
  // Convert to absolute path if relative
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(getImageStorageDir(), filePath);
  }
  
  // Normalize path for current OS
  return path.normalize(filePath);
}

// Function to generate web-friendly path
function getWebPath(filePath: string): string {
  // Normalize for current OS first
  const normalizedPath = normalizeFilePath(filePath);
  // Convert to web URL format (always use forward slashes)
  return `file://${normalizedPath.replace(/\\/g, '/')}`;
}

// Function to ensure directory exists
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
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
          category: {
            type: "string",
            description: "Optional category folder for organizing images",
            default: ""
          }
        },
        required: ["prompt"]
      }
    },
    {
      name: "create_image_html",
      description: "Create HTML img tags from image file paths with gallery view",
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
          },
          gallery: {
            type: "boolean",
            description: "Whether to create a gallery view with CSS",
            default: true
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
        category?: string;
      };
      const { 
        prompt, 
        numberOfImages = 1,
        category = ""
      } = args;
      
      // Get storage directory for current OS
      const baseDir = getImageStorageDir();
      const outputDir = category ? path.join(baseDir, category) : baseDir;
      
      // Ensure output directory exists
      await ensureDirectoryExists(outputDir);

      console.log('Saving images to:', outputDir);

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
          outputDir,
          `${sanitizedPrompt}-${timestamp}-${idx}.png`
        );
        
        await fs.promises.writeFile(filename, buffer);
        generatedFiles.push(normalizeFilePath(filename));
        
        console.log('Generated image saved at:', filename);
        idx++;
      }

      return {
        toolResult: {
          message: `Successfully generated ${generatedFiles.length} images in AI-Generated-Images${category ? path.sep + category : ''} on your Desktop`,
          files: generatedFiles,
          storageDir: outputDir,
          desktopPath: getUserDesktopPath(),
          osType: process.platform,
          userHome: os.homedir()
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
        gallery?: boolean;
      };
      const { imagePaths, width = 512, height = 512, gallery = true } = args;

      // Create gallery CSS if requested
      const galleryStyle = gallery ? `
        <style>
          .image-gallery {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
            padding: 20px;
          }
          .image-container {
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.3s ease;
          }
          .image-container:hover {
            transform: scale(1.05);
          }
          .image-container img {
            display: block;
            width: ${width}px;
            height: ${height}px;
            object-fit: contain;
          }
        </style>
      ` : '';

      const htmlTags = imagePaths.map(imagePath => {
        // Get absolute path and normalize it
        const absolutePath = normalizeFilePath(imagePath);
        
        // Verify file exists
        if (!fs.existsSync(absolutePath)) {
          console.warn(`Warning: Image file not found: ${absolutePath}`);
        }
        
        const webPath = getWebPath(absolutePath);
        
        if (gallery) {
          return `
            <div class="image-container">
              <img src="${webPath}" alt="Generated image" loading="lazy" />
            </div>
          `;
        }
        
        return `<img src="${webPath}" width="${width}" height="${height}" alt="Generated image" style="margin: 10px;" />`;
      });

      const html = gallery 
        ? `${galleryStyle}<div class="image-gallery">${htmlTags.join('\n')}</div>`
        : htmlTags.join('\n');

      return {
        toolResult: {
          html,
          message: `Created HTML gallery with ${imagePaths.length} images`,
          storageLocation: getImageStorageDir(),
          absolutePaths: imagePaths.map(p => normalizeFilePath(p))
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