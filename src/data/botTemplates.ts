/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BotTemplate {
  name: string;
  description: string;
  scriptValue: string;
  defaultEnv: { [key: string]: string };
}

export const botTemplates: BotTemplate[] = [
  {
    name: "Customer Support AI Bot",
    description: "An automated helper that replies to user messages, checks order status, and answers FAQs with natural flows.",
    defaultEnv: {
      "BOT_NAME": "SereneHelper",
      "SUPPORT_EMAIL": "help@sereneapp.com",
      "WELCOME_MSG": "Hi! Thanks for reaching out. How can I assist you with your order today?"
    },
    scriptValue: `// Secure Support AI Bot Runtime
// Intercepts and answers mock chat interactions!

bot.on('start', () => {
  bot.log(\`🟢 Support Bot [\${bot.env.BOT_NAME || 'SupportBot'}] successfully booted.\`);
  bot.log(\`📬 Listening for simulated incoming queries. Support email is configured to: \${bot.env.SUPPORT_EMAIL}\`);
  bot.log(\`💬 Send a test message in the chat portal on the right to interact with me!\`);
});

bot.on('message', (message) => {
  bot.log(\`📥 Received message: "\${message.text}" from \${message.sender}\`);
  
  const text = message.text.toLowerCase().trim();
  let reply = "";

  if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    reply = bot.env.WELCOME_MSG || "Hello there! How can I help you today?";
  } 
  else if (text.includes('price') || text.includes('cost') || text.includes('pricing')) {
    reply = "💰 Our Starter plan starts at $9/month, and the Pro Developer plan is $29/month. You can scale up anytime!";
  } 
  else if (text.includes('refund') || text.includes('return') || text.includes('cancel')) {
    reply = \`⚠️ For order refunds or cancellations, please email our support team at \${bot.env.SUPPORT_EMAIL || 'support@example.com'}. We typically resolve requests in under 12 hours!\`;
  } 
  else if (text.includes('status') || text.includes('track') || text.includes('order')) {
    const randomOrder = Math.floor(Math.random() * 900000) + 100000;
    reply = \`📦 Checking database... Found matching order #\${randomOrder}. Status: [IN TRANSIT] • Handed off to local carrier.\`;
  } 
  else if (text.includes('help') || text.includes('menu')) {
    reply = "📋 Available keyword triggers: [hi], [price], [refund], [status], or [help]";
  } 
  else {
    reply = \`🤖 Thank you for your inquiry: "\${message.text}". That is currently outside my support map. Please email our human agents at \${bot.env.SUPPORT_EMAIL} for detailed advice!\`;
  }

  // Send a delayed friendly reply to simulate natural AI thinking latency!
  setTimeout(() => {
    bot.sendReply(reply);
    bot.log(\`📤 Sent automatic response: "\${reply.substring(0, 45)}..."\`);
  }, 800);
});

bot.on('stop', () => {
  bot.log("🛑 Customer Support Bot has shut down.");
});
`
  },
  {
    name: "Crypto Ticker & Alert Bot",
    description: "Periodically monitors simulated crypto values (BTC, ETH) and logs alerts when pricing thresholds are crossed.",
    defaultEnv: {
      "ALERT_THRESHOLD_BTC": "98000",
      "UPDATE_INTERVAL_SEC": "4"
    },
    scriptValue: `// Crypto Ticker & Alert Bot
// Simulates checking real-time API charts and executing trading signals!

let intervalId = null;
let currentBtcPrice = 97500;

bot.on('start', () => {
  const threshold = parseFloat(bot.env.ALERT_THRESHOLD_BTC || '98000');
  const delaySec = parseInt(bot.env.UPDATE_INTERVAL_SEC || '4');
  
  bot.log(\`🔥 Crypto Ticker Bot ONLINE.\`);
  bot.log(\`📈 Watching Bitcoin prices. Alert trigger set to cross above: $\${threshold} USD.\`);
  
  // Begin the loop
  intervalId = setInterval(() => {
    // Simulate minor price fluctuation (-500 to +800 USD)
    const delta = Math.floor(Math.random() * 1300) - 500;
    currentBtcPrice += delta;
    
    bot.log(\`📊 [TICK] BTC/USD: $\${currentBtcPrice.toLocaleString()} (Change: \${delta >= 0 ? '+' : ''}\${delta} USD)\`);
    
    if (currentBtcPrice >= threshold) {
      bot.log(\`🚨 [ALERT] Bitcoin has breached your threshold! Current Price: $\${currentBtcPrice.toLocaleString()} >= $\${threshold.toLocaleString()}\`);
      bot.sendReply(\`🔔 ALERT: Bitcoin is surging! Price is now $\${currentBtcPrice.toLocaleString()}! Action: [STRONG BUY SIGNAL]\`);
    }
  }, delaySec * 1000);
});

bot.on('stop', () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  bot.log("🛑 Crypto monitor scheduler stopped.");
});
`
  },
  {
    name: "Task Scheduler & System Monitor",
    description: "Executes automated system checkups, prints resource usages, and schedules mock database optimization routines.",
    defaultEnv: {
      "SERVER_REGION": "us-east4-cloud-run",
      "SYS_ALERT_THRESHOLD": "90"
    },
    scriptValue: `// System Monitor Automation Routine
let loopId = null;

bot.on('start', () => {
  bot.log(\`⚙️ Task Automation Daemon starting...\`);
  bot.log(\`🌍 Mock Server Target: \${bot.env.SERVER_REGION || 'global-ingress'}\`);
  
  loopId = setInterval(() => {
    // Generate mock stats
    const cpu = Math.floor(Math.random() * 30) + 10;
    const mem = Math.floor(Math.random() * 40) + 40;
    const status = cpu > parseInt(bot.env.SYS_ALERT_THRESHOLD || '90') ? '🔴 CRITICAL' : '🟢 HEALTHY';
    
    bot.log(\`[CRON] System Diagnostics: CPU \${cpu}% | MEM \${mem}% | Status: \${status}\`);
    
    // Simulate database backups occasionally
    if (Math.random() > 0.7) {
      bot.log(\`💾 [BACKUP] Automated snapshot of 'virtual_fs_prod' initiated...\`);
      bot.log(\`✨ [BACKUP] Snapshot finished. Checksum verified: MD5 \${Math.random().toString(36).substring(4, 12).toUpperCase()}\`);
    }
  }, 5000);
});

bot.on('stop', () => {
  if (loopId) {
    clearInterval(loopId);
  }
  bot.log("🛑 Monitor daemon killed.");
});
`
  },
  {
    name: "Gemini Conversational AI Bot",
    description: "An advanced chat assistant that connects directly to the server-side Gemini API (gemini-2.5-flash) to answer any conversational query dynamically!",
    defaultEnv: {
      "BOT_NAME": "GeminiMind",
      "SYS_PROMPT": "You are a witty, extremely smart developer helper. Keep answers short and fun!"
    },
    scriptValue: `// Gemini Conversational AI Bot
// Connects directly to server-side Gemini flash API to generate dynamic natural responses!

bot.on('start', () => {
  bot.log(\`🟢 \${bot.env.BOT_NAME || 'GeminiMind'} is online and synced to the cloud.\`);
  bot.log("💡 Send any text in the right Chat Portal. I will forward it to Gemini and reply!");
});

bot.on('message', (message) => {
  const text = message.text;
  bot.log(\`📥 Received user text: "\${text}"\`);
  bot.log("🤖 Querying server-side Gemini model...");
  
  // Call the live Gemini model!
  bot.getAI(text, (reply) => {
    bot.log(\`📤 Gemini response received! Sending reply...\`);
    bot.sendReply(reply);
  });
});

bot.on('stop', () => {
  bot.log("🛑 Gemini AI Bot has disconnected.");
});
`
  }
];
