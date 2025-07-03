const fs = require("fs");
const path = require("path");

const walk = (dir, callback) => {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, callback);
    } else if (file === "index.html") {
      callback(fullPath);
    }
  });
};

const cleanJsContent = (js) => {
  return js
    .replace(/<!--[\s\S]*?-->/g, "") // remove all <!-- ... --> comments
    .replace(/^\s*<!--\s*/gm, "") // remove lines with only <!--
    .replace(/^\s*-->\s*/gm, "") // remove lines with only -->
    .trim();
};

const extractAssets = (htmlPath) => {
  let html = fs.readFileSync(htmlPath, "utf-8");
  const dir = path.dirname(htmlPath);
  const baseName = path.basename(htmlPath, ".html");

  // Extract <style> content
  const cssMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  const cssContent = cssMatches.map((match) => match[1].trim()).join("\n\n");

  // Remove all <style> blocks from html to add link later
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Extract inline <script> (skip external src and type=application/ld+json)
  const jsMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const jsContents = [];

  for (const match of jsMatches) {
    const fullMatch = match[0];
    const attrs = match[1];
    const content = match[2];

    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) {
      // keep JSON-LD scripts inline, do nothing
      continue;
    }

    if (/src\s*=/i.test(attrs)) {
      // external scripts, keep as is
      continue;
    }

    // Clean JS content from HTML comments <!-- ... -->
    const cleanJs = cleanJsContent(content);

    jsContents.push(cleanJs);

    // Remove inline script from HTML, we will add external reference later
    html = html.replace(fullMatch, "");
  }

  // Add CSS link tag if CSS extracted
  if (cssContent) {
    const cssFile = `${baseName}.css`;
    fs.writeFileSync(path.join(dir, cssFile), cssContent, "utf-8");
    html = html.replace("</head>", `  <link rel="stylesheet" href="${cssFile}">\n</head>`);
  }

  // Add JS script tag if JS extracted
  if (jsContents.length > 0) {
    const jsFile = `${baseName}.js`;
    fs.writeFileSync(path.join(dir, jsFile), jsContents.join("\n\n"), "utf-8");
    html = html.replace("</body>", `  <script src="${jsFile}"></script>\n</body>`);
  }

  // Write updated HTML back
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`Processed: ${htmlPath}`);
};

const staticDir = path.join(__dirname, "hood-static");
walk(staticDir, extractAssets);
