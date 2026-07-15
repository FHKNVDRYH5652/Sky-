/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Elegant multi-page static portfolio website for Instant Demo
export const sampleSiteFiles = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZipHost | Virtual Static Web Hosting</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="logo">⚡ ZipHost</div>
    <h1>Hosting Success!</h1>
    <p>This entire static website was extracted from a <strong>ZIP archive</strong> and is being hosted 100% in-browser using a client-side Service Worker.</p>
    
    <div class="stats-box">
      <div class="stat">
        <span class="value" id="counter">0</span>
        <span class="label">Interactive Clicks</span>
      </div>
      <div class="stat">
        <span class="value">2026</span>
        <span class="label">Active Year</span>
      </div>
    </div>

    <div class="button-group">
      <button id="clickBtn" class="btn btn-primary">Click Me for JS Power!</button>
      <a href="about.html" class="btn btn-secondary">Visit About Page &rarr;</a>
    </div>

    <p class="footer-text">Built dynamically with HTML, CSS, & Javascript</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,

  'about.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About ZipHost Preview</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="logo">⚡ About ZipHost</div>
    <h1>Multi-Page Support</h1>
    <p>Notice how you navigated to <code>about.html</code>? The relative hyperlink routing resolves perfectly inside our isolated sandbox!</p>
    
    <div class="content-text">
      <h3>Key Capabilities Demonstrated:</h3>
      <ul>
        <li><strong>Relative Links:</strong> Multi-page static routing.</li>
        <li><strong>CSS Cascading:</strong> Shared stylesheet file <code>style.css</code>.</li>
        <li><strong>In-Memory Virtual Hosting:</strong> Zero disk write latency.</li>
      </ul>
    </div>

    <div class="button-group">
      <a href="index.html" class="btn btn-primary">&larr; Return Home</a>
    </div>

    <p class="footer-text">Testing client-side sub-paths securely</p>
  </div>
</body>
</html>`,

  'style.css': `/* Modern high-contrast CSS styled with high-fidelity pairings */
body {
  margin: 0;
  padding: 0;
  background: radial-gradient(circle at top, #0f172a, #020617);
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  box-sizing: border-box;
}

.card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 40px;
  max-width: 480px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
}

.logo {
  font-weight: 700;
  color: #38bdf8;
  font-size: 1.1rem;
  letter-spacing: -0.025em;
  margin-bottom: 20px;
  text-transform: uppercase;
}

h1 {
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 15px 0;
  letter-spacing: -0.05em;
  background: linear-gradient(to right, #ffffff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #94a3b8;
  margin: 0 0 25px 0;
}

code {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #e2e8f0;
}

.stats-box {
  display: flex;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 15px 10px;
  margin-bottom: 30px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.stat {
  display: flex;
  flex-direction: column;
}

.value {
  font-size: 1.6rem;
  font-weight: 700;
  color: #38bdf8;
}

.label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 5px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 25px;
}

@media (min-width: 480px) {
  .button-group {
    flex-direction: row;
    justify-content: center;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #38bdf8;
  color: #0f172a;
}

.btn-primary:hover {
  background: #0ea5e9;
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(56, 189, 248, 0.2);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.content-text {
  text-align: left;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 25px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.content-text h3 {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  color: #e2e8f0;
}

.content-text ul {
  margin: 0;
  padding-left: 20px;
}

.content-text li {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.footer-text {
  font-size: 0.75rem;
  color: #475569;
  margin: 0;
}`,

  'script.js': `// Dynamic interaction inside sandboxed virtual static workspace
let clickCount = 0;
const counterEl = document.getElementById('counter');
const clickBtn = document.getElementById('clickBtn');

if (clickBtn && counterEl) {
  clickBtn.addEventListener('click', () => {
    clickCount++;
    counterEl.innerText = clickCount;
    
    // Add visual bounce animation
    counterEl.style.transform = 'scale(1.3)';
    counterEl.style.transition = 'transform 0.1s ease';
    setTimeout(() => {
      counterEl.style.transform = 'scale(1)';
    }, 100);
    
    // Generate simple interactive logs
    console.log('[ZipHost Console] Click count incremented:', clickCount);
  });
}
`
};
