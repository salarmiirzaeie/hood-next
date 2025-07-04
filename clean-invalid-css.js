const fs = require('fs-extra');
const path = require('path');
const postcss = require('postcss');
const safe = require('postcss-safe-parser');
const discardEmpty = require('postcss-discard-empty');
const discardDuplicates = require('postcss-discard-duplicates');

// Function to validate CSS property names
function isValidCSSProperty(prop) {
  const validProps = [
    // Layout
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
    'float', 'clear', 'overflow', 'overflow-x', 'overflow-y', 'clip',
    'visibility', 'box-sizing',
    
    // Dimensions
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    
    // Margin & Padding
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    
    // Border
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'border-radius',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    
    // Background
    'background', 'background-color', 'background-image', 'background-repeat',
    'background-position', 'background-size', 'background-attachment', 'background-clip',
    'background-origin',
    
    // Text & Font
    'color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style',
    'font-variant', 'line-height', 'letter-spacing', 'word-spacing',
    'text-align', 'text-decoration', 'text-transform', 'text-indent',
    'text-shadow', 'white-space', 'word-wrap', 'word-break',
    
    // Flexbox
    'flex', 'flex-direction', 'flex-wrap', 'flex-flow', 'flex-grow',
    'flex-shrink', 'flex-basis', 'justify-content', 'align-items',
    'align-self', 'align-content', 'order',
    
    // Grid
    'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
    'grid-template-areas', 'grid-gap', 'grid-column-gap', 'grid-row-gap',
    'grid-column', 'grid-row', 'grid-area', 'justify-self', 'place-items',
    
    // Animation & Transform
    'transform', 'transform-origin', 'transition', 'transition-property',
    'transition-duration', 'transition-timing-function', 'transition-delay',
    'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction',
    'animation-fill-mode', 'animation-play-state',
    
    // Other
    'opacity', 'cursor', 'outline', 'outline-width', 'outline-style', 'outline-color',
    'box-shadow', 'resize', 'user-select', 'pointer-events', 'content',
    'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
    'table-layout', 'border-collapse', 'border-spacing', 'caption-side',
    'empty-cells', 'vertical-align'
  ];
  
  return validProps.includes(prop.toLowerCase()) || prop.startsWith('-webkit-') || prop.startsWith('-moz-') || prop.startsWith('-ms-') || prop.startsWith('-o-');
}

// Function to validate CSS values
function isValidCSSValue(value) {
  if (!value || typeof value !== 'string') return false;
  
  // Remove quotes and trim
  const cleanValue = value.replace(/['"]/g, '').trim();
  
  // Check for obviously invalid values
  if (cleanValue.length === 0) return false;
  if (cleanValue.includes('undefined') || cleanValue.includes('null')) return false;
  
  // Allow common CSS value patterns
  const validPatterns = [
    /^[a-zA-Z][a-zA-Z0-9-]*$/, // keywords like 'auto', 'none', 'inherit'
    /^#[0-9a-fA-F]{3,8}$/, // hex colors
    /^rgb\([^)]+\)$/, // rgb colors
    /^rgba\([^)]+\)$/, // rgba colors
    /^hsl\([^)]+\)$/, // hsl colors
    /^hsla\([^)]+\)$/, // hsla colors
    /^[0-9]+(\.[0-9]+)?(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax|fr)$/, // units
    /^[0-9]+(\.[0-9]+)?$/, // numbers
    /^calc\([^)]+\)$/, // calc function
    /^url\([^)]+\)$/, // url function
    /^var\([^)]+\)$/, // CSS variables
    /^[a-zA-Z0-9\s,.-]+$/ // general alphanumeric with common punctuation
  ];
  
  return validPatterns.some(pattern => pattern.test(cleanValue));
}

// Function to clean CSS by removing invalid rules
function cleanInvalidCSS(css) {
  return new Promise((resolve, reject) => {
    postcss([discardEmpty(), discardDuplicates()])
      .process(css, { parser: safe })
      .then(result => {
        const cleanedRoot = postcss.root();
        
        result.root.walkRules(rule => {
          const validDeclarations = [];
          
          rule.walkDecls(decl => {
            if (isValidCSSProperty(decl.prop) && isValidCSSValue(decl.value)) {
              validDeclarations.push(decl.clone());
            }
          });
          
          // Only keep rules that have valid declarations
          if (validDeclarations.length > 0) {
            const newRule = rule.clone();
            newRule.removeAll();
            validDeclarations.forEach(decl => newRule.append(decl));
            cleanedRoot.append(newRule);
          }
        });
        
        // Keep at-rules (like @media, @keyframes) if they're valid
        result.root.walkAtRules(atRule => {
          if (atRule.name && atRule.name.match(/^[a-zA-Z-]+$/)) {
            cleanedRoot.append(atRule.clone());
          }
        });
        
        resolve(cleanedRoot.toString());
      })
      .catch(reject);
  });
}

async function cleanCSSFile(inputFile, outputFile) {
  try {
    console.log(`🔧 Processing: ${inputFile}`);
    
    const css = await fs.readFile(inputFile, 'utf8');
    const cleanedCSS = await cleanInvalidCSS(css);
    
    await fs.writeFile(outputFile, cleanedCSS);
    console.log(`✅ Cleaned: ${outputFile}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${inputFile}:`, error.message);
    return false;
  }
}

async function main() {
  const inputFile = path.join(__dirname, 'styles', 'test.css');
  const outputFile = path.join(__dirname, 'styles', 'test-cleaned.css');
  
  // Ensure input file exists
  if (!await fs.pathExists(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    return;
  }
  
  await cleanCSSFile(inputFile, outputFile);
  console.log('\n🎉 CSS cleaning completed!');
}

main().catch(console.error); 