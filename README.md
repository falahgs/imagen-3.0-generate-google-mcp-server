# Gemini Imagen 3.0 MCP Server

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.3.3-blue)

A professional Model Context Protocol (MCP) server implementation that harnesses Google's Imagen 3.0 model through the Gemini API for high-quality image generation. Built with TypeScript and designed for seamless integration with Claude Desktop and other MCP-compatible hosts.

## 🌟 Features

- Leverage Google's state-of-the-art Imagen 3.0 model via Gemini API
- Generate up to 4 high-quality images per request
- Automatic file management with intelligent naming
- HTML preview generation with file:// protocol support
- Built on MCP protocol for AI agent compatibility
- TypeScript implementation with robust error handling

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- Google Gemini API key
- Claude Desktop or another MCP-compatible host

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gemini-imagen-mcp-server.git
cd gemini-imagen-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## ⚙️ Configuration

1. Configure Claude Desktop by adding to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "gemini-image-gen": {
      "command": "node",
      "args": ["./build/index.js"],
      "cwd": "<path-to-project-directory>",
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key"
      }
    }
  }
}
```

2. Replace placeholders:
   - `<path-to-project-directory>`: Your project path
   - `your-gemini-api-key`: Your Gemini API key

## 🛠️ Available Tools

### 1. generate_images
Generates images using Google's Imagen 3.0 model.

Parameters:
- `prompt` (required): Text description of the image to generate
- `numberOfImages` (optional): Number of images (1-4, default: 1)

File Management:
- Images are automatically saved in `G:\image-gen3-google-mcp-server\images`
- Filenames follow the pattern: `{sanitized-prompt}-{timestamp}-{index}.png`
- Timestamps ensure unique filenames
- Prompts are sanitized for safe filesystem usage

Example:
```
Generate an image of a futuristic city at night
```

### 2. create_image_html
Creates HTML preview tags for generated images.

Parameters:
- `imagePaths` (required): Array of image file paths
- `width` (optional): Image width in pixels (default: 512)
- `height` (optional): Image height in pixels (default: 512)

Returns HTML tags with absolute file:// URLs for local viewing.

Example:
```
Create HTML tags for the generated images with width=400
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (when available)
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Error Handling

The server implements two main error codes:
- `tool_not_found` (1): When the requested tool is not available
- `execution_error` (2): When image generation or HTML creation fails

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## ✨ Author

**Falah G. Salieh**
- Copyright © 2025
- GitHub: [@yourgithubhandle](https://github.com/yourgithubhandle)
- Email: [your.email@example.com](mailto:your.email@example.com)

## 🙏 Acknowledgments

- Google Gemini API and Imagen 3.0 model
- Model Context Protocol (MCP) by Anthropic
- Claude Desktop team for MCP host implementation

## 📌 Tags

`#MCP` `#Gemini` `#Imagen3` `#AI` `#ImageGeneration` `#TypeScript` `#NodeJS` `#GoogleAI` `#ClaudeDesktop`

---
Made with ❤️ by Falah G. Salieh 