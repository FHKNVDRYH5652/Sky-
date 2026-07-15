/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON parser with large limits for website asset transfers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialize Gemini client to prevent startup crashes if GEMINI_API_KEY is not set
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required but missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * AI Code Copilot - Edit, complete, or generate static code inside the editor
 */
app.post('/api/ai/edit', async (req, res) => {
  try {
    const { prompt, filePath, fileContent, projectContext } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    const systemInstruction = `
You are a master web developer and senior code refactoring assistant.
Your task is to take the user's prompt and edit or generate code for a specific file in their virtual workspace.

Return ONLY the complete, correct, and pristine source code of the edited file.
Do NOT wrap your response in markdown code blocks like \`\`\`html or \`\`\`javascript or \`\`\`css, UNLESS the file itself is a Markdown (.md) file.
Just return the raw code lines. No conversational intros, explanations, or commentaries.
    `.trim();

    const userPrompt = `
File Path to edit: ${filePath || 'index.html'}
Current File Content:
---
${fileContent || ''}
---

Overall Project Context (Files present in workspace):
${JSON.stringify(projectContext || {})}

Modification Instruction:
${prompt}
    `.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for high precision code edits
      },
    });

    let codeOutput = response.text || '';
    
    // Clean up accidental markdown code block wrap if the model ignored instructions
    if (codeOutput.trim().startsWith('```')) {
      const lines = codeOutput.split('\n');
      if (lines[0].trim().startsWith('```')) {
        lines.shift();
      }
      if (lines[lines.length - 1].trim().startsWith('```')) {
        lines.pop();
      }
      codeOutput = lines.join('\n');
    }

    res.json({ code: codeOutput });
  } catch (err: any) {
    console.error('[Gemini AI Edit Error]:', err);
    res.status(500).json({ error: err.message || 'Gemini Code Copilot failed to process request.' });
  }
});

/**
 * Bot AI Helper Proxy - Allows sandboxed bots to make secure server-side AI requests
 */
app.post('/api/bot/ai', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a helpful chat bot agent. Keep replies brief, conversational, and direct (under 3 sentences). Do not use markdown styling unless necessary.',
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text || "I'm not sure how to respond to that." });
  } catch (err: any) {
    console.error('[Bot AI Proxy Error]:', err);
    res.json({ reply: `[AI Connection Error: ${err.message || 'Service offline'}]` });
  }
});

/**
 * Generates a clean, modern, and beautiful hardcoded fallback page when cloning fails
 */
function generateStaticFallback(domain: string, errorMessage: string) {
  const siteName = domain.split('.')[0];
  const capitalizedSiteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  
  const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${capitalizedSiteName} - Smart Simulated Sandbox Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap">
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
    h1, h2, h3, .font-display {
      font-family: 'Space Grotesk', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white">
  <!-- Interactive Navigation -->
  <header class="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
          ${capitalizedSiteName.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <span class="font-display font-bold text-xl tracking-tight text-white">${capitalizedSiteName}</span>
          <span class="text-xs text-indigo-400 block font-mono">simulated_${siteName}.io</span>
        </div>
      </div>
      
      <nav class="hidden md:flex items-center gap-6 text-sm text-slate-300 font-medium">
        <a href="#features" class="hover:text-indigo-400 transition-colors">Features</a>
        <a href="#services" class="hover:text-indigo-400 transition-colors">Services</a>
        <a href="#dashboard" class="hover:text-indigo-400 transition-colors">Interactive Demo</a>
        <a href="#pricing" class="hover:text-indigo-400 transition-colors">Pricing</a>
      </nav>

      <div class="flex items-center gap-3">
        <button onclick="alert('Welcome to ${capitalizedSiteName}! This is a smart simulated preview since the original URL returned an offline/restricted status.')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-95">
          Get Started
        </button>
      </div>
    </div>
  </header>

  <!-- Banner alerting why it's a simulation -->
  <div class="bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-300 px-6 py-3 text-center text-xs md:text-sm font-medium flex items-center justify-center gap-2">
    <span class="flex h-2 w-2 relative">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
    </span>
    Original page fetch responded with status: ${errorMessage}. ZipHost automatically spun up this ultra-polished, fully editable simulated mockup of <strong>${domain}</strong>!
  </div>

  <main class="flex-grow">
    <!-- Hero Section -->
    <section class="relative py-24 px-6 overflow-hidden">
      <!-- Background Glows -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div class="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div class="max-w-4xl mx-auto text-center relative z-10">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6 font-mono">
          🚀 BRAND NEW SIMULATION
        </span>
        <h1 class="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Welcome to the new era of <br>
          <span class="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">${capitalizedSiteName}</span>
        </h1>
        <p class="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The ultimate digital gateway for <strong>${domain}</strong>. Fully loaded with modern components, customizable code structures, and responsive layouts designed for infinite scale.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#dashboard" class="w-full sm:w-auto bg-white text-slate-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-100 transition-all text-center shadow-lg active:scale-95">
            Launch Sandbox Demo
          </a>
          <a href="#features" class="w-full sm:w-auto bg-slate-900/80 border border-slate-800 text-slate-300 font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-800 hover:text-white transition-all text-center active:scale-95">
            Learn More
          </a>
        </div>
      </div>
    </section>

    <!-- Key Features / Value Proposition -->
    <section id="features" class="py-20 px-6 bg-slate-900/30 border-t border-slate-900">
      <div class="max-w-7xl mx-auto">
        <div class="text-center max-w-2xl mx-auto mb-16">
          <h2 class="font-display text-3xl font-bold text-white mb-4">Engineered for absolute performance</h2>
          <p class="text-slate-400">Discover the powerful characteristics that set ${capitalizedSiteName} apart from traditional legacy approaches.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-indigo-500/40 transition-all group hover:-translate-y-1">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 font-bold group-hover:scale-110 transition-transform">
              ⚡
            </div>
            <h3 class="font-display text-xl font-bold text-white mb-3">Ultra-Fast Loading</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Sub-millisecond dynamic client hydration optimized for modern hardware, edge servers, and cloud caches.</p>
          </div>

          <div class="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-purple-500/40 transition-all group hover:-translate-y-1">
            <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 font-bold group-hover:scale-110 transition-transform">
              🔒
            </div>
            <h3 class="font-display text-xl font-bold text-white mb-3">End-to-End Encryption</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Rest assured knowing every transfer and user preference is protected by industrial-grade sandboxing protocols.</p>
          </div>

          <div class="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-pink-500/40 transition-all group hover:-translate-y-1">
            <div class="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-6 font-bold group-hover:scale-110 transition-transform">
              🛠️
            </div>
            <h3 class="font-display text-xl font-bold text-white mb-3">Infinite Customization</h3>
            <p class="text-slate-400 text-sm leading-relaxed">You can edit this code block live in the code editor panels. Change headings, layouts, or brand colors instantly!</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Component (Simulating site behavior) -->
    <section id="dashboard" class="py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div class="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-red-500/60"></span>
              <span class="w-3 h-3 rounded-full bg-yellow-500/60"></span>
              <span class="w-3 h-3 rounded-full bg-green-500/60"></span>
              <span class="text-xs font-mono text-slate-500 ml-2">interactive_demo.sh</span>
            </div>
            <span class="text-xs font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-md">Demo Sandbox Running</span>
          </div>

          <div class="p-8">
            <div class="max-w-xl mx-auto text-center mb-8">
              <h3 class="font-display text-2xl font-bold text-white mb-2">Simulate Business Operations</h3>
              <p class="text-slate-400 text-sm">Experience how ${capitalizedSiteName} handles dynamic data state management in real time.</p>
            </div>

            <!-- Dynamic Simulator Applet -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Simulation Variable A</label>
                  <input type="text" id="simName" value="Awesome Customer" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Simulation Tier</label>
                  <select id="simTier" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none transition-colors">
                    <option value="Standard Explorer">Standard Explorer (1x Speed)</option>
                    <option value="Enterprise Pro">Enterprise Pro (10x Speed)</option>
                    <option value="Galaxy Titan" selected>Galaxy Titan (100x Speed)</option>
                  </select>
                </div>
                <button onclick="runSimulation()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg active:scale-95">
                  Execute Live Variable Updates
                </button>
              </div>

              <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800/80 space-y-4 font-mono text-xs text-slate-400">
                <div class="text-indigo-400 font-bold border-b border-slate-800 pb-2">Simulator Diagnostics Logs</div>
                <div id="simLog" class="space-y-1.5 min-h-[120px] max-h-[120px] overflow-y-auto">
                  <div>[System OK] Simulator idle. Ready to configure.</div>
                </div>
                <div class="flex justify-between text-[10px] text-slate-600 border-t border-slate-800 pt-2">
                  <span>Engine v4.12.0</span>
                  <span>Latency: <strong class="text-emerald-400">0.2ms</strong></span>
                </div>
              </div>
            </div>

            <script>
              function runSimulation() {
                const name = document.getElementById('simName').value;
                const tier = document.getElementById('simTier').value;
                const logDiv = document.getElementById('simLog');
                
                const timestamp = new Date().toLocaleTimeString();
                const logLines = [
                  \`[\${timestamp}] [Init] Booting simulation container...\`,
                  \`[\${timestamp}] [Config] Binding target: \${name}\`,
                  \`[\${timestamp}] [Active] Mode: \${tier}\`,
                  \`[\${timestamp}] [Success] Simulation variables updated live!\`
                ];

                logDiv.innerHTML = '';
                logLines.forEach((line, index) => {
                  setTimeout(() => {
                    const el = document.createElement('div');
                    el.className = index === 3 ? 'text-emerald-400 font-bold' : '';
                    el.innerText = line;
                    logDiv.appendChild(el);
                    logDiv.scrollTop = logDiv.scrollHeight;
                  }, index * 250);
                });
              }
            </script>
          </div>
        </div>
      </div>
    </section>

    <!-- Simple Call to Action -->
    <section class="py-20 px-6 relative bg-gradient-to-t from-slate-950 to-slate-900 border-t border-slate-900">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="font-display text-3xl sm:text-4xl font-bold text-white mb-4">Start crafting ${capitalizedSiteName} today</h2>
        <p class="text-slate-400 max-w-xl mx-auto mb-8">This entire file tree has been downloaded. Click on any file in the left explorer to make edits and view changes live.</p>
        <button onclick="alert('Demo successfully installed.')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-95">
          Download Simulated Blueprint
        </button>
      </div>
    </section>
  </main>

  <!-- Clean Footer -->
  <footer class="border-t border-slate-900 bg-slate-950 py-12 px-6 text-slate-500 text-xs font-mono">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
      <div>
        &copy; 2026 ${capitalizedSiteName}. Powered by the ZipHost Extractor.
      </div>
      <div class="flex items-center gap-6">
        <span>Status: <strong class="text-emerald-400">Dynamic Simulation</strong></span>
        <span>Original URL error: 404/Restricted</span>
      </div>
    </div>
  </footer>
</body>
</html>
  `.trim();

  const filesMap: { [path: string]: { content: string; mimeType: string; isBinary: boolean } } = {
    'index.html': {
      content: fallbackHtml,
      mimeType: 'text/html',
      isBinary: false
    }
  };

  return {
    siteName,
    files: filesMap
  };
}

/**
 * Generates an ultra-premium simulated brand mockup using Gemini AI
 */
async function generateMockupWithGemini(urlStr: string, errorMessage: string): Promise<{ siteName: string; files: { [path: string]: { content: string; mimeType: string; isBinary: boolean } } }> {
  let domain = 'example.com';
  let siteName = 'sandbox';
  let capitalizedSiteName = 'Sandbox';

  try {
    const targetUrl = new URL(urlStr);
    domain = targetUrl.hostname.replace('www.', '') || 'example.com';
    siteName = domain.split('.')[0] || 'sandbox';
    capitalizedSiteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  } catch (e) {
    console.warn('[Extractor] Failed parsing URL for mockup brand:', e);
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `
You are a world-class frontend engineer. The user wanted to clone the website "${urlStr}", but it returned an error: "${errorMessage}".
Your task is to generate a beautiful, modern, high-fidelity single-page simulated clone of "${domain}" (themed perfectly around its brand and purpose).
The mockup MUST look incredibly premium, fully responsive, and professional.
Use Tailwind CSS via its CDN script (<script src="https://cdn.tailwindcss.com"></script>) in the HTML header.
Include beautiful custom interactive elements (e.g., modern hero section, features grid, product showcases, testimonials, interactive custom widgets, dynamic tabs, pricing, contact forms, search inputs, custom animated hover effects, etc.).
Ensure all icons are styled SVG icons or clean emoji indicators.
Return ONLY the complete, correct, and pristine source code of the HTML file.
Do NOT wrap your response in markdown code blocks like \`\`\`html or \`\`\`javascript, just return the raw HTML code. No intro or explanation.
`.trim();

    const userPrompt = `
Generate a beautiful frontend HTML prototype for the brand "${capitalizedSiteName}" (${domain}).
Include rich mock content, custom navigation, beautiful interactive features, clean responsive layout, and fully customized components that simulate what the real "${domain}" does.
Make sure the UI is extremely polished, utilizing a cohesive color scheme suited to the brand (e.g. deep blues for tech, sleek dark slate for portfolios, warm earth tones for organic/lifestyle, etc.).
Make it feel alive with rich details!
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    let codeOutput = response.text || '';
    if (codeOutput.trim().startsWith('```')) {
      const lines = codeOutput.split('\n');
      if (lines[0].trim().startsWith('```')) {
        lines.shift();
      }
      if (lines[lines.length - 1].trim().startsWith('```')) {
        lines.pop();
      }
      codeOutput = lines.join('\n');
    }

    const filesMap: { [path: string]: { content: string; mimeType: string; isBinary: boolean } } = {
      'index.html': {
        content: codeOutput,
        mimeType: 'text/html',
        isBinary: false
      }
    };

    return {
      siteName,
      files: filesMap
    };
  } catch (error: any) {
    console.error('[Mockup Generation Error]:', error);
    return generateStaticFallback(domain, errorMessage || error.message);
  }
}

/**
 * Advanced Web Cloner / Extractor
 * Fetches a webpage and all of its linked stylesheets, scripts, and media resources
 * to turn them into local relative virtual files for instant editing and hosting!
 */
app.post('/api/extract', async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Target website URL is required.' });
    }

    // Ensure protocol is attached
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const targetUrl = new URL(url);
    const origin = targetUrl.origin;
    const basePath = targetUrl.href.substring(0, targetUrl.href.lastIndexOf('/') + 1) || (origin + '/');

    let htmlResponse;
    let originalHtml = '';
    let isMockFallback = false;
    let fallbackData: any = null;

    try {
      console.log(`[Extractor] Fetching main page: ${targetUrl.href}`);
      htmlResponse = await fetch(targetUrl.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });

      // 404 path recovery: If a subpath is entered and returns 404, fallback to root origin of that domain
      if (!htmlResponse.ok && targetUrl.pathname !== '/' && targetUrl.pathname !== '') {
        console.log(`[Extractor] Fetching subpath failed with ${htmlResponse.status}. Trying domain root fallback: ${targetUrl.origin}`);
        const fallbackRes = await fetch(targetUrl.origin, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
          }
        });
        if (fallbackRes.ok) {
          htmlResponse = fallbackRes;
          targetUrl.pathname = '/';
        }
      }

      if (!htmlResponse.ok) {
        throw new Error(`Failed to download website. Server responded with status ${htmlResponse.status}`);
      }

      originalHtml = await htmlResponse.text();
    } catch (fetchErr: any) {
      console.warn(`[Extractor Warning] Fetching webpage failed: ${fetchErr.message || fetchErr}. Spinning up simulated preview mockup...`);
      isMockFallback = true;
      const errorMsg = fetchErr.message || 'Server responded with offline status';
      fallbackData = await generateMockupWithGemini(url, errorMsg);
    }

    if (isMockFallback && fallbackData) {
      return res.json({
        siteName: fallbackData.siteName,
        files: fallbackData.files
      });
    }

    const $ = cheerio.load(originalHtml);

    const filesMap: { [path: string]: { content: string; mimeType: string; isBinary: boolean } } = {};
    const assetPromises: Promise<void>[] = [];

    // Helper to resolve URLs relatively or absolutely
    function resolveAssetUrl(src: string): string {
      if (!src) return '';
      if (src.startsWith('//')) return 'https:' + src;
      if (src.startsWith('http://') || src.startsWith('https://')) return src;
      if (src.startsWith('/')) return origin + src;
      return basePath + src;
    }

    // Helper to get clean relative path inside our extracted zip folder
    function getCleanRelativePath(src: string, defaultFolder: string): string {
      if (!src) return '';
      try {
        // Strip out query parameters
        const cleanSrc = src.split('?')[0];
        const parts = cleanSrc.split('/');
        const filename = parts.pop() || 'index.html';
        
        // If relative asset is in a subdirectory, preserve it or bucket it
        const dirParts = parts.filter(p => p && !p.startsWith('http') && p !== '..' && p !== '.');
        if (dirParts.length > 0) {
          return [...dirParts, filename].join('/');
        }
        return `${defaultFolder}/${filename}`;
      } catch {
        return `${defaultFolder}/asset_${Math.random().toString(36).substring(2, 6)}`;
      }
    }

    // 2. Locate and process linked styles
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absUrl = resolveAssetUrl(href);
      const relativeDestPath = getCleanRelativePath(href, 'css');

      // Update link href in the HTML to point to local relative file
      $(el).attr('href', relativeDestPath);

      // Schedule asset download
      const fetchAsset = async () => {
        try {
          console.log(`[Extractor] Downloading style: ${absUrl}`);
          const assetRes = await fetch(absUrl);
          if (assetRes.ok) {
            const cssText = await assetRes.text();
            filesMap[relativeDestPath] = {
              content: cssText,
              mimeType: 'text/css',
              isBinary: false
            };
          }
        } catch (e) {
          console.warn(`[Extractor Warning] Failed to download CSS asset: ${absUrl}`, e);
        }
      };
      assetPromises.push(fetchAsset());
    });

    // 3. Locate and process scripts
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      const absUrl = resolveAssetUrl(src);
      const relativeDestPath = getCleanRelativePath(src, 'js');

      // Update script src in HTML to local path
      $(el).attr('src', relativeDestPath);

      // Schedule asset download
      const fetchAsset = async () => {
        try {
          console.log(`[Extractor] Downloading script: ${absUrl}`);
          const assetRes = await fetch(absUrl);
          if (assetRes.ok) {
            const jsText = await assetRes.text();
            filesMap[relativeDestPath] = {
              content: jsText,
              mimeType: 'application/javascript',
              isBinary: false
            };
          }
        } catch (e) {
          console.warn(`[Extractor Warning] Failed to download Script asset: ${absUrl}`, e);
        }
      };
      assetPromises.push(fetchAsset());
    });

    // 4. Locate and process small images/vectors
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      
      // Skip data URLs
      if (src.startsWith('data:')) return;

      const absUrl = resolveAssetUrl(src);
      const relativeDestPath = getCleanRelativePath(src, 'images');

      // Update image src in HTML
      $(el).attr('src', relativeDestPath);

      // Schedule image fetch
      const fetchAsset = async () => {
        try {
          console.log(`[Extractor] Downloading image: ${absUrl}`);
          const assetRes = await fetch(absUrl);
          if (assetRes.ok) {
            const arrayBuffer = await assetRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const ext = relativeDestPath.split('.').pop()?.toLowerCase() || 'png';
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
            
            filesMap[relativeDestPath] = {
              content: base64,
              mimeType,
              isBinary: true
            };
          }
        } catch (e) {
          console.warn(`[Extractor Warning] Failed to download Image asset: ${absUrl}`, e);
        }
      };
      assetPromises.push(fetchAsset());
    });

    // Wait for all assets to download
    await Promise.all(assetPromises);

    // Write final HTML file to map (relative path is index.html)
    filesMap['index.html'] = {
      content: $.html(),
      mimeType: 'text/html',
      isBinary: false
    };

    console.log(`[Extractor] Successfully extracted ${Object.keys(filesMap).length} resources for ${url}`);
    res.json({
      siteName: targetUrl.hostname.replace('www.', ''),
      files: filesMap
    });

  } catch (err: any) {
    console.error('[Extractor Error]:', err);
    res.status(500).json({ error: err.message || 'Web cloner failed to fetch or parse the target link.' });
  }
});

// ----------------------------------------------------
// RUNTIME ENVIRONMENT INGRESS (DEV / PROD)
// ----------------------------------------------------

async function bootServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development mode uses Vite Dev Server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serves precompiled bundles from dist/
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running full-stack on http://0.0.0.0:${PORT}`);
  });
}

bootServer().catch((err) => {
  console.error('[Server Boot Error]:', err);
});
