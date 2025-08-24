import { registerFunction } from "@sashimo/lib"
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

registerFunction({
  name: "get_system_info",
  description: "Get detailed Node.js system information",
  parameters: {},
  handler: async () => {
    return {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        loadavg: os.loadavg()
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage_percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      cpu: {
        model: os.cpus()[0]?.model || 'Unknown',
        cores: os.cpus().length,
        speed: os.cpus()[0]?.speed || 0
      },
      network: os.networkInterfaces(),
      node: {
        version: process.version,
        pid: process.pid,
        uptime: process.uptime(),
        cwd: process.cwd(),
        platform: process.platform
      },
      source: "Node.js Native Server"
    }
  }
})

registerFunction({
  name: "get_process_info",
  description: "Get current Node.js process information",
  parameters: {},
  handler: async () => {
    const memUsage = process.memoryUsage()
    
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      version: process.version,
      versions: process.versions,
      uptime: process.uptime(),
      cwd: process.cwd(),
      execPath: process.execPath,
      argv: process.argv,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        HOST: process.env.HOST
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      source: "Node.js Native Server"
    }
  }
})

registerFunction({
  name: "get_directory_listing",
  description: "Get listing of files and directories in the current working directory",
  parameters: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "Directory path to list (defaults to current working directory)",
        default: "."
      },
      showHidden: {
        type: "boolean",
        description: "Whether to show hidden files",
        default: false
      }
    }
  },
  handler: async ({ directory = ".", showHidden = false }: { directory?: string, showHidden?: boolean }) => {
    try {
      const fullPath = path.resolve(directory)
      const items = fs.readdirSync(fullPath)
      
      const filteredItems = showHidden ? items : items.filter(item => !item.startsWith('.'))
      
      const itemDetails = filteredItems.map(item => {
        const itemPath = path.join(fullPath, item)
        const stats = fs.statSync(itemPath)
        
        return {
          name: item,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          permissions: stats.mode.toString(8).slice(-3)
        }
      })
      
      return {
        directory: fullPath,
        items: itemDetails,
        total: itemDetails.length,
        source: "Node.js Native Server"
      }
    } catch (error) {
      throw new Error(`Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
})

registerFunction({
  name: "get_environment_variables",
  description: "Get environment variables (filtered for security)",
  parameters: {},
  handler: async () => {
    // Filter out sensitive environment variables
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'api', 'private']
    const filteredEnv = Object.entries(process.env)
      .filter(([key]) => !sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive)))
      .reduce((acc, [key, value]) => {
        acc[key] = value || ''
        return acc
      }, {} as Record<string, string>)
    
    // Include some safe environment variables even if they contain sensitive keywords
    const safeEnvVars = ['NODE_ENV', 'PORT', 'HOST', 'DEBUG']
    safeEnvVars.forEach(key => {
      if (process.env[key]) {
        filteredEnv[key] = process.env[key]!
      }
    })
    
    return {
      environment: filteredEnv,
      count: Object.keys(filteredEnv).length,
      note: "Sensitive environment variables are filtered out for security",
      source: "Node.js Native Server"
    }
  }
})

registerFunction({
  name: "ping_server",
  description: "Simple ping function to test server responsiveness",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Optional message to echo back",
        default: "pong"
      }
    }
  },
  handler: async ({ message = "pong" }: { message?: string }) => {
    return {
      response: message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      source: "Node.js Native Server"
    }
  }
})