import fs from 'fs-extra';
import path from 'path';

interface TemplateConfig {
    framework: 'nextjs' | 'nodejs' | 'express';
    typescript: boolean;
    apiKey: string;
    hubUrl?: string;
    rootDir: string;
}

export async function createConfigFiles(config: TemplateConfig) {
    const { framework, typescript, apiKey, hubUrl, rootDir } = config;

    // Create .env.local or .env file
    await createEnvFile(rootDir, apiKey, hubUrl);

    // Create sashi.config file
    await createSashiConfig(rootDir, typescript, framework);

    // Create framework-specific files
    switch (framework) {
        case 'nextjs':
            await createNextJSFiles(rootDir, typescript);
            break;
        case 'express':
            await createExpressFiles(rootDir, typescript);
            break;
        case 'nodejs':
            await createNodeJSFiles(rootDir, typescript);
            break;
    }
}

async function createEnvFile(rootDir: string, apiKey: string, hubUrl?: string) {
    const envPath = path.join(rootDir, '.env.local');
    const envContent = `# Sashi Configuration
OPENAI_API_KEY=${apiKey}
${hubUrl ? `SASHI_HUB_URL=${hubUrl}` : '# SASHI_HUB_URL=https://your-hub-url.com'}

# Add other environment variables as needed
`;

    await fs.writeFile(envPath, envContent);
}

async function createSashiConfig(rootDir: string, typescript: boolean, framework: string) {
    const configPath = path.join(rootDir, `sashi.config.${typescript ? 'ts' : 'js'}`);

    const configContent = typescript ? `
import type { SashiConfig } from '@sashimo/lib';

const config: SashiConfig = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4', // or 'gpt-3.5-turbo'
  },

  // Hub Configuration (optional)
  hub: {
    url: process.env.SASHI_HUB_URL,
  },

  // Middleware Configuration
  middleware: {
    path: '/sashi',
    cors: {
      origin: process.env.NODE_ENV === 'development' ? '*' : false,
    },
  },

  // UI Configuration (for Next.js)
  ${framework === 'nextjs' ? `ui: {
    theme: 'light', // or 'dark' or 'auto'
    branding: {
      title: 'Admin Panel',
      logo: '/logo.png', // optional
    },
  },` : ''}

  // Function Configuration
  functions: {
    loadDefaults: false, // Set to true to load default utility functions
    hiddenFromUI: [], // Function names to hide from UI dropdown
  },
};

export default config;
` : `
const config = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4', // or 'gpt-3.5-turbo'
  },

  // Hub Configuration (optional)
  hub: {
    url: process.env.SASHI_HUB_URL,
  },

  // Middleware Configuration
  middleware: {
    path: '/sashi',
    cors: {
      origin: process.env.NODE_ENV === 'development' ? '*' : false,
    },
  },

  // UI Configuration (for Next.js)
  ${framework === 'nextjs' ? `ui: {
    theme: 'light', // or 'dark' or 'auto'
    branding: {
      title: 'Admin Panel',
      logo: '/logo.png', // optional
    },
  },` : ''}

  // Function Configuration
  functions: {
    loadDefaults: false, // Set to true to load default utility functions
    hiddenFromUI: [], // Function names to hide from UI dropdown
  },
};

module.exports = config;
`;

    await fs.writeFile(configPath, configContent);
}

async function createNextJSFiles(rootDir: string, typescript: boolean) {
    // Create API route for Sashi
    const apiDir = path.join(rootDir, 'pages', 'api', 'sashi');
    await fs.ensureDir(apiDir);

    const apiContent = typescript ? `
import { NextApiRequest, NextApiResponse } from 'next';
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../../../sashi.config';

const sashiMiddleware = createSashiMiddleware(config);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return sashiMiddleware(req, res);
}
` : `
import { createSashiMiddleware } from '@sashimo/lib';
import config from '../../../sashi.config';

const sashiMiddleware = createSashiMiddleware(config);

export default async function handler(req, res) {
  return sashiMiddleware(req, res);
}
`;

    await fs.writeFile(path.join(apiDir, `[[...slug]].${typescript ? 'ts' : 'js'}`), apiContent);

    // Create Sashi page
    const pagesDir = path.join(rootDir, 'pages', 'sashi');
    await fs.ensureDir(pagesDir);

    const pageContent = typescript ? `
import { SashiUI } from '@sashimo/ui';
import config from '../../sashi.config';

export default function SashiPage() {
  return <SashiUI config={config} />;
}
` : `
import { SashiUI } from '@sashimo/ui';
import config from '../../sashi.config';

export default function SashiPage() {
  return <SashiUI config={config} />;
}
`;

    await fs.writeFile(path.join(pagesDir, `index.${typescript ? 'tsx' : 'jsx'}`), pageContent);
}

async function createExpressFiles(rootDir: string, typescript: boolean) {
    const exampleContent = typescript ? `
import express from 'express';
import { createSashiMiddleware } from '@sashimo/lib';
import config from './sashi.config';

const app = express();
const sashiMiddleware = createSashiMiddleware(config);

// Add Sashi middleware
app.use('/sashi', sashiMiddleware);

// Your other routes...
app.get('/', (req, res) => {
  res.json({ message: 'Hello World! Sashi admin available at /sashi' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Sashi admin available at http://localhost:\${PORT}/sashi\`);
});
` : `
const express = require('express');
const { createSashiMiddleware } = require('@sashimo/lib');
const config = require('./sashi.config');

const app = express();
const sashiMiddleware = createSashiMiddleware(config);

// Add Sashi middleware
app.use('/sashi', sashiMiddleware);

// Your other routes...
app.get('/', (req, res) => {
  res.json({ message: 'Hello World! Sashi admin available at /sashi' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Sashi admin available at http://localhost:\${PORT}/sashi\`);
});
`;

    await fs.writeFile(path.join(rootDir, `sashi-example.${typescript ? 'ts' : 'js'}`), exampleContent);
}

async function createNodeJSFiles(rootDir: string, typescript: boolean) {
    const exampleContent = typescript ? `
import http from 'http';
import { createSashiMiddleware } from '@sashimo/lib';
import config from './sashi.config';

const sashiMiddleware = createSashiMiddleware(config);

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/sashi')) {
    return sashiMiddleware(req, res);
  }

  // Your other routes...
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Hello World! Sashi admin available at /sashi' 
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Sashi admin available at http://localhost:\${PORT}/sashi\`);
});
` : `
const http = require('http');
const { createSashiMiddleware } = require('@sashimo/lib');
const config = require('./sashi.config');

const sashiMiddleware = createSashiMiddleware(config);

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/sashi')) {
    return sashiMiddleware(req, res);
  }

  // Your other routes...
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Hello World! Sashi admin available at /sashi' 
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Sashi admin available at http://localhost:\${PORT}/sashi\`);
});
`;

    await fs.writeFile(path.join(rootDir, `sashi-example.${typescript ? 'ts' : 'js'}`), exampleContent);
} 