const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const staticDir = path.resolve(__dirname, "hood-static");
const nextRoot = path.resolve(__dirname, "hood-next");
const nextPagesDir = path.join(nextRoot, "pages");

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fixSelfClosingTags(html) {
  const selfClosing = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr",
  ];
  selfClosing.forEach((tag) => {
    const regex = new RegExp(`<${tag}([^>]*)>(?!</${tag}>)`, "gi");
    html = html.replace(regex, `<${tag}$1 />`);
  });
  return html;
}

function convertHtmlToJsx(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, ""); // remove comments
  html = html.replace(/\bclass=/g, "className=");
  html = fixSelfClosingTags(html);
  return html;
}

function writeFileRecursive(filePath, content) {
  ensureDirExists(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

function migratePageFolder(pageSrcPath, pageDestPath) {
  ensureDirExists(pageDestPath);

  const indexHtmlPath = path.join(pageSrcPath, "index.html");
  const indexCssPath = path.join(pageSrcPath, "index.css");
  const indexJsPath = path.join(pageSrcPath, "index.js");

  if (!fs.existsSync(indexHtmlPath)) {
    console.warn(`Skipping ${pageSrcPath}: no index.html found.`);
    return;
  }

  const html = fs.readFileSync(indexHtmlPath, "utf-8");
  const $ = cheerio.load(html);
  let bodyHtml = $("body").html() || "";
  bodyHtml = bodyHtml.trim();
  const jsxBody = convertHtmlToJsx(bodyHtml);

  // Copy CSS as CSS module if exists
  let cssImport = null;
  if (fs.existsSync(indexCssPath)) {
    const cssModulePath = path.join(pageDestPath, "index.module.css");
    fs.copyFileSync(indexCssPath, cssModulePath);
    cssImport = "./index.module.css";
  }

  // Copy JS if exists
  let jsImport = null;
  if (fs.existsSync(indexJsPath)) {
    const jsDestPath = path.join(pageDestPath, "index.js");
    fs.copyFileSync(indexJsPath, jsDestPath);
    jsImport = "./index.js";
  }

  // Make component name from folder name
  const folderName = path.basename(pageSrcPath);
  const componentName = folderName
    .split(/[-_ ]+/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");

  const pageComponent = `
import Head from 'next/head';
${cssImport ? `import styles from '${cssImport}';` : ""}
${jsImport ? `import pageScript from '${jsImport}';` : ""}
import { useEffect } from 'react';

export default function ${componentName}() {
  useEffect(() => {
    if (pageScript && typeof pageScript === 'function') {
      pageScript();
    }
  }, []);

  return (
    <>
      <Head>
        <title>${componentName}</title>
      </Head>
      <div${cssImport ? " className={styles.wrapper}" : ""}>
        ${jsxBody}
      </div>
    </>
  );
}
`;

  writeFileRecursive(path.join(pageDestPath, "index.jsx"), pageComponent.trim());

  console.log(`✅ Converted ${pageSrcPath} → ${path.join(pageDestPath, "index.jsx")}`);
}

function migrateFolderRecursively(srcDir, destDir) {
  const items = fs.readdirSync(srcDir, { withFileTypes: true });

  // Migrate current folder if it contains index.html
  if (items.some((item) => item.isFile() && item.name === "index.html")) {
    migratePageFolder(srcDir, destDir);
  }

  // Always recurse into subdirectories (to find nested pages)
  items.forEach((item) => {
    if (item.isDirectory()) {
      const subSrc = path.join(srcDir, item.name);
      const subDest = path.join(destDir, item.name);
      migrateFolderRecursively(subSrc, subDest);
    }
  });
}

function writeNextConfig() {
  const content = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig;
`;
  writeFileRecursive(path.join(nextRoot, "next.config.js"), content);
}

function writePackageJson() {
  const pkg = {
    name: "hood-next",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      next: "^13.4.0",
    },
  };
  writeFileRecursive(path.join(nextRoot, "package.json"), JSON.stringify(pkg, null, 2));
}

// Main
ensureDirExists(nextRoot);
migrateFolderRecursively(staticDir, nextPagesDir);
writeNextConfig();
writePackageJson();

console.log('🎉 Migration complete! Your Next.js app is ready in "hood-next".');
console.log("Run `cd hood-next && npm install && npm run dev` to start your Next.js app.");
