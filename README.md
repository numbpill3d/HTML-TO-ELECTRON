# HTML to Electron File Splitter

A powerful Node.js tool that converts HTML files with inline CSS and JavaScript into Electron-ready applications by extracting styles and scripts into separate files.

## Features

- **🔧 Smart Extraction**: Automatically extracts all `<style>` and `<script>` content
- **📁 Electron Ready**: Creates complete Electron app structure with boilerplate files
- **🎯 Flexible Options**: CLI and programmatic interfaces with customizable options
- **📦 Zip Export**: Optional bundling of output files for easy distribution
- **🛡️ Error Handling**: Comprehensive validation and error reporting
- **⚡ Fast Performance**: Efficient parsing using Cheerio
- **📱 Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites
- Node.js 14.0.0 or higher
- npm or yarn package manager

### Install Dependencies

```bash
npm install
```

Required dependencies:
- `cheerio`: HTML parsing and manipulation
- `archiver`: ZIP file creation

## Usage

### Command Line Interface (CLI)

```bash
# Basic usage
node cli.js input.html

# With custom output directory
node cli.js input.html --output my-electron-app

# Create zip file
node cli.js input.html --zip

# Combined options
node cli.js input.html --output my-app --zip
```

#### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--output` | `-o` | Output directory name | `electron-output` |
| `--zip` | `-z` | Create ZIP file | `false` |
| `--help` | `-h` | Show help message | - |
| `--version` | `-v` | Show version | - |

#### CLI Examples

```bash
# Process a complex HTML file
node cli.js sample.html --output file-manager-app --zip

# Quick processing with default settings
node cli.js index.html

# Get help
node cli.js --help
```

### Programmatic API

```javascript
const HTMLElectronSplitter = require('./file-splitter');

// Create instance
const splitter = new HTMLElectronSplitter();

// Basic usage
const result = await splitter.splitHTMLtoElectron('input.html');

// With options
const result = await splitter.splitHTMLtoElectron('input.html', {
    outputDir: 'my-electron-app',
    createZip: true
});

// Handle results
if (result.success) {
    console.log('Files created:', result.files);
    console.log('Output directory:', result.outputDirectory);
} else {
    console.error('Error:', result.error);
}
```

#### API Options

```javascript
{
    outputDir: 'custom-output',    // Custom output directory
    createZip: true,               // Create ZIP file
    // Future options can be added here
}
```

## Input Requirements

Your HTML file should contain:
- **Inline CSS**: `<style>` tags in the `<head>` or `<body>`
- **Inline JavaScript**: `<script>` tags with content (not external src)
- **Valid HTML structure**: Proper DOCTYPE and HTML tags

### Example Input HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f0f0f0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello World</h1>
        <button id="myButton">Click me</button>
    </div>
    
    <script>
        document.getElementById('myButton').addEventListener('click', () => {
            alert('Button clicked!');
        });
        
        console.log('App initialized');
    </script>
</body>
</html>
```

## Output Structure

The tool creates a complete Electron application structure:

```
electron-output/
├── index.html          # Modified HTML (references external files)
├── style.css           # Extracted CSS styles
├── renderer.js         # Extracted JavaScript code
├── main.js             # Electron main process boilerplate
├── package.json        # Electron app configuration
└── README.md          # Setup instructions
```

### Generated Files

#### `index.html`
- Original HTML with inline styles/scripts removed
- Links to external `style.css` and `renderer.js`
- Maintains all other content and structure

#### `style.css`
- All CSS from `<style>` tags
- Preserves media queries and CSS comments
- Handles multiple style blocks

#### `renderer.js`
- All JavaScript from `<script>` tags
- Excludes external scripts (src attribute)
- Maintains script execution order

#### `main.js`
- Electron main process boilerplate
- Window creation and management
- Basic security settings
- Development tools integration

#### `package.json`
- Electron dependencies and scripts
- Build configuration for electron-builder
- Cross-platform build targets

## Running the Electron App

After splitting your HTML file:

```bash
# Navigate to output directory
cd electron-output

# Install Electron dependencies
npm install

# Run the application
npm start

# Run in development mode (with DevTools)
npm run dev

# Build for distribution
npm run build
```

## Advanced Features

### Multiple Style Blocks
Handles multiple `<style>` tags and preserves their order:

```html
<style media="screen">
    /* Screen styles */
</style>
<style media="print">
    /* Print styles */
</style>
```

### Script Type Handling
Processes different script types appropriately:

```html
<script type="text/javascript">
    // Standard JavaScript
</script>
<script type="module">
    // ES6 modules
</script>
```

### Error Recovery
- Graceful handling of malformed HTML
- Detailed error messages
- Partial processing when possible

## Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite includes:
- Basic file splitting functionality
- Options and configuration testing
- Error handling validation
- File system operations
- Cleanup procedures

### Manual Testing

Use the provided sample file:

```bash
npm run example
```

This processes `example/sample.html` and creates `example-output/` with all files.

## Troubleshooting

### Common Issues

**File not found error**
```
Error: File not found: input.html
```
- Ensure the file path is correct
- Use absolute paths if needed
- Check file permissions

**Permission denied**
```
Error: Failed to create output directory
```
- Check write permissions in the target directory
- Run with appropriate user privileges
- Ensure the output path is valid

**Empty CSS/JS files**
```
/* No CSS content found */
// No JavaScript content found
```
- This is normal if no inline styles/scripts exist
- External stylesheets and scripts are preserved in HTML
- Check that `<style>` and `<script>` tags contain content

### Performance Tips

- Use SSD storage for better file I/O performance
- Process files in parallel for batch operations
- Consider file size limits for very large HTML files

## Development

### Project Structure

```
html-electron-splitter/
├── file-splitter.js    # Main splitting logic
├── cli.js              # Command line interface
├── package.json        # Project configuration
├── test/
│   └── test-splitter.js # Test suite
├── example/
│   └── sample.html     # Example input file
└── README.md          # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Code Style

- Use ES6+ features
- Follow Node.js best practices
- Add JSDoc comments for functions
- Handle errors gracefully
- Write comprehensive tests

## API Reference

### HTMLElectronSplitter Class

#### Constructor
```javascript
new HTMLElectronSplitter()
```

#### Methods

**`splitHTMLtoElectron(inputFilePath, options)`**
- **Parameters:**
  - `inputFilePath` (string): Path to input HTML file
  - `options` (object): Configuration options
- **Returns:** Promise\<object\> - Result object with success status and file paths
- **Throws:** Error for invalid inputs or file system issues

**`validateInputFile(inputFilePath)`**
- **Parameters:**
  - `inputFilePath` (string): Path to validate
- **Returns:** Promise\<void\>
- **Throws:** Error if file is invalid

**`extractCSS($)`**
- **Parameters:**
  - `$` (cheerio): Cheerio instance with loaded HTML
- **Returns:** string - Extracted CSS content

**`extractJavaScript($)`**
- **Parameters:**
  - `$` (cheerio): Cheerio instance with loaded HTML
- **Returns:** string - Extracted JavaScript content

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0
- Initial release
- Basic HTML splitting functionality
- CLI interface
- Electron boilerplate generation
- ZIP export feature
- Comprehensive test suite

## Support

For issues, questions, or contributions:
- GitHub Issues: [Create an issue](https://github.com/username/html-electron-splitter/issues)
- Documentation: [Wiki](https://github.com/username/html-electron-splitter/wiki)
- Email: support@example.com

---

**Made with ❤️ for the Electron community**
