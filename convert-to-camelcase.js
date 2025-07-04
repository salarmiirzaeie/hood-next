const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');
const safe = require('postcss-safe-parser');

// Function to convert kebab-case to camelCase
function kebabToCamel(str) {
  return str.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
}

// PostCSS plugin to convert class names to camelCase
const camelCasePlugin = postcss.plugin('camelcase-classes', () => {
  return (root) => {
    root.walkRules(rule => {
      // Convert class selectors in the rule
      rule.selectors = rule.selectors.map(selector => {
        return selector.replace(/\.([\w-]+)/g, (match, className) => {
          // Only convert if it contains a hyphen
          if (className.includes('-')) {
            return `.${kebabToCamel(className)}`;
          }
          return match;
        });
      });
    });
  };
});

// Function to convert CSS class names to camelCase
async function convertToCamelCase(inputFile, outputFile) {
  try {
    console.log(`🔄 Converting class names in: ${inputFile}`);
    
    const css = await fs.readFile(inputFile, 'utf8');
    
    // Process CSS with PostCSS and the camelCase plugin
    const result = await postcss([camelCasePlugin()])
      .process(css, { from: inputFile, to: outputFile, parser: safe });
    
    await fs.writeFile(outputFile, result.css);
    console.log(`✅ Converted: ${outputFile}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error converting ${inputFile}:`, error.message);
    return false;
  }
}

// Function to process all CSS files in a directory
async function convertAllFilesInDirectory(inputDir, outputDir) {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    // Read all files from input directory
    const files = await fs.readdir(inputDir);
    
    for (const file of files) {
      if (path.extname(file) === '.css') {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file);
        
        await convertToCamelCase(inputPath, outputPath);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing directory:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default: convert all files in styles directory
    const inputDir = path.join(__dirname, 'styles');
    const outputDir = path.join(__dirname, 'camelcase-styles');
    
    console.log('🚀 Converting all CSS files to camelCase...');
    console.log(`📁 Input directory: ${inputDir}`);
    console.log(`📁 Output directory: ${outputDir}`);
    
    await convertAllFilesInDirectory(inputDir, outputDir);
    
  } else if (args.length === 1) {
    // Single file conversion
    const inputFile = args[0];
    const outputFile = inputFile.replace(/\.css$/, '-camelcase.css');
    
    console.log('🚀 Converting single CSS file to camelCase...');
    await convertToCamelCase(inputFile, outputFile);
    
  } else if (args.length === 2) {
    // Input and output file specified
    const [inputFile, outputFile] = args;
    
    console.log('🚀 Converting CSS file to camelCase...');
    await convertToCamelCase(inputFile, outputFile);
    
  } else {
    console.log('Usage:');
    console.log('  npm run convert-camelcase                    # Convert all files in styles/ to camelcase-styles/');
    console.log('  npm run convert-camelcase input.css         # Convert input.css to input-camelcase.css');
    console.log('  npm run convert-camelcase input.css output.css  # Convert input.css to output.css');
    return;
  }
  
  console.log('\n🎉 CamelCase conversion completed!');
}

main().catch(console.error); 