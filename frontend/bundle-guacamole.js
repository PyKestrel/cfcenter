#!/usr/bin/env node
/**
 * Script to bundle guacamole-common-js into a single browser-ready file.
 * Usage: node bundle-guacamole.js
 */

const path = require('path');
const fs = require('fs');

const esbuild = require('esbuild');

async function bundle() {
  try {
    const pkgPath = path.join(__dirname, 'node_modules/guacamole-common-js/package.json');

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      console.log(`guacamole-common-js version: ${pkg.version}`);
    }

    // guacamole-common-js ships a pre-built CJS bundle — use it directly
    const cjsBundle = path.join(__dirname, 'node_modules/guacamole-common-js/dist/cjs/guacamole-common.js');
    const outDir = path.join(__dirname, 'public/guacamole');
    const outFile = path.join(outDir, 'guacamole.bundle.js');

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    if (fs.existsSync(cjsBundle)) {
      // Bundle the CJS module into a browser-ready IIFE
      await esbuild.build({
        entryPoints: [cjsBundle],
        bundle: true,
        outfile: outFile,
        format: 'iife',
        globalName: 'GuacamoleModule',
        platform: 'browser',
        target: ['es2020'],
        minify: false,
        sourcemap: false,
        footer: {
          js: '(function() { var G = GuacamoleModule; if (G && G.default) G = G.default; if (G && G.Guacamole) { window.Guacamole = G.Guacamole; } else { window.Guacamole = G; } })();'
        }
      });
      console.log('✅ guacamole-common-js bundled successfully to public/guacamole/guacamole.bundle.js');
    } else {
      console.error('❌ Could not find guacamole-common-js CJS bundle at:', cjsBundle);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to bundle guacamole-common-js:', error.message);
    process.exit(1);
  }
}

bundle();
