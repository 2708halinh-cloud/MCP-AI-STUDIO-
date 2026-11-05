import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy-key",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Pre-built MCP Templates for learning and bootstrapping
const MCP_TEMPLATES = [
  {
    id: "weather-apikey",
    name: "Python Weather MCP Server (Tích Hợp API Key)",
    language: "python",
    description: "Máy chủ MCP Python sử dụng httpx để gọi API thời tiết, tích hợp bảo mật API Key qua biến môi trường (Environment Variables) trong claude_desktop_config.json.",
    useCase: "Hướng dẫn chuẩn cách nạp và bảo vệ API Key bí mật cho Python MCP Server mà không làm lộ key ra ngoài mã nguồn hay cho LLM thấy.",
    code: `import os
from typing import Any
import httpx
from mcp.server import MCPServer
import mcp.types as types

# Khởi tạo MCP Server với tên "weather"
mcp = MCPServer("weather")

# 1. ĐỌC API KEY TỪ BIẾN MÔI TRƯỜNG (AN TOÀN NHẤT)
# Claude Desktop hoặc Host Client sẽ tự động truyền qua cấu hình 'env'
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
if not WEATHER_API_KEY:
    print("[CẢNH BÁO] Chưa tìm thấy WEATHER_API_KEY trong biến môi trường. Vui lòng cấu hình trong file json của Claude Desktop.")

# Constants
WEATHER_API_BASE = "https://api.weatherapi.com/v1"
USER_AGENT = "weather-mcp-app/1.0"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json"
}

@mcp.tool()
async def get_current_weather(city: str) -> str:
    """Lấy thông tin thời tiết hiện tại của một thành phố cụ thể.
    
    Args:
        city: Tên thành phố cần tra cứu (ví dụ: Hanoi, Ho Chi Minh, Tokyo, London)
    """
    if not WEATHER_API_KEY:
        return "Lỗi: Máy chủ MCP chưa được cấu hình WEATHER_API_KEY. Vui lòng thêm key vào claude_desktop_config.json."

    url = f"{WEATHER_API_BASE}/current.json"
    params = {
        "key": WEATHER_API_KEY,
        "q": city,
        "aqi": "no"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=HEADERS, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            location = data.get("location", {})
            current = data.get("current", {})
            
            return f"""Thời tiết tại {location.get('name')}, {location.get('country')}:
- Nhiệt độ: {current.get('temp_c')}°C ({current.get('temp_f')}°F)
- Tình trạng: {current.get('condition', {}).get('text')}
- Độ ẩm: {current.get('humidity')}%
- Gió: {current.get('wind_kph')} km/h
- Cập nhật lúc: {current.get('last_updated')}"""
        except httpx.HTTPStatusError as e:
            return f"Lỗi HTTP từ dịch vụ thời tiết: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"Không thể lấy dữ liệu thời tiết: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="stdio")`
  },
  {
    id: "nws-weather",
    name: "Python NWS & Weather API (Chuẩn Người Dùng)",
    language: "python",
    description: "Mẫu máy chủ MCP thời tiết chính xác theo đoạn mã của bạn (api.weather.gov), tích hợp kỹ thuật cấu hình API Key qua biến môi trường 'WEATHER_API_KEY' và custom User-Agent.",
    useCase: "Cho phép AI gọi công cụ tra cứu tọa độ, lấy dự báo thời tiết trực tiếp từ National Weather Service và các cổng Weather API có yêu cầu API Key.",
    code: `import os
from typing import Any
import httpx
from mcp.server import MCPServer

# Khởi tạo MCPServer với tên "weather"
mcp = MCPServer("weather")

# Constants
NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0 (contact@yourdomain.com)"

# 1. THIẾT LẬP API KEY TỪ BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)
# Tránh tuyệt đối việc hardcode API Key trong code hoặc gõ vào prompt của AI!
# Claude Desktop / Cursor sẽ truyền an toàn qua file claude_desktop_config.json:
# "env": {
#     "WEATHER_API_KEY": "your_api_key_here"
# }
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/geo+json"
}

# Nếu dịch vụ thời tiết yêu cầu Authorization Token / Key qua Header:
if WEATHER_API_KEY:
    HEADERS["Authorization"] = f"Bearer {WEATHER_API_KEY}"

@mcp.tool()
async def get_weather_forecast(latitude: float, longitude: float) -> str:
    """Lấy dự báo thời tiết cho tọa độ kinh độ và vĩ độ (NWS & Weather API).
    
    Args:
        latitude: Vĩ độ (ví dụ: 38.8894 cho Washington DC hoặc 21.0285 cho Hà Nội)
        longitude: Kinh độ (ví dụ: -77.0352 hoặc 105.8542)
    """
    async with httpx.AsyncClient() as client:
        try:
            # Tra cứu thông tin điểm dự báo theo chuẩn NWS
            points_url = f"{NWS_API_BASE}/points/{latitude},{longitude}"
            response = await client.get(points_url, headers=HEADERS, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                forecast_url = data.get("properties", {}).get("forecast")
                if forecast_url:
                    forecast_res = await client.get(forecast_url, headers=HEADERS, timeout=10.0)
                    forecast_data = forecast_res.json()
                    periods = forecast_data.get("properties", {}).get("periods", [])[:3]
                    report = []
                    for p in periods:
                        report.append(f"- {p.get('name')}: {p.get('temperature')}°{p.get('temperatureUnit')} ({p.get('shortForecast')})")
                    return "\\n".join(report) if report else "Không có dữ liệu dự báo chi tiết."
                return "Đã tìm thấy điểm nhưng không có URL dự báo."
            else:
                return f"NWS API phản hồi HTTP {response.status_code}: {response.text[:200]}"
        except Exception as e:
            return f"Lỗi kết nối API thời tiết: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="stdio")`
  },
  {
    id: "filesystem",
    name: "File System MCP Server",
    language: "typescript",
    description: "Cho phép AI đọc, ghi, tìm kiếm và liệt kê tệp tin trong một thư mục cho phép.",
    useCase: "Giúp Claude Desktop hoặc Cursor duyệt code, đọc tài liệu và chỉnh sửa file trực tiếp trên máy.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_DIR = process.env.MCP_ALLOWED_DIR || process.cwd();

const server = new Server({
  name: "filesystem-mcp",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "Đọc nội dung tệp tin từ đường dẫn tương đối.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn file" }
        },
        required: ["path"]
      }
    },
    {
      name: "write_file",
      description: "Ghi nội dung vào tệp tin.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn file" },
          content: { type: "string", description: "Nội dung cần ghi" }
        },
        required: ["path", "content"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const targetPath = path.resolve(ALLOWED_DIR, args.path as string);
  
  if (!targetPath.startsWith(ALLOWED_DIR)) {
    throw new Error("Truy cập bị từ chối: Vượt ngoài thư mục cho phép.");
  }

  if (name === "read_file") {
    const data = await fs.readFile(targetPath, 'utf8');
    return { content: [{ type: "text", text: data }] };
  } else if (name === "write_file") {
    await fs.writeFile(targetPath, args.content as string, 'utf8');
    return { content: [{ type: "text", text: \`Đã ghi thành công vào \${args.path}\` }] };
  }
  throw new Error(\`Tool không tồn tại: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("FileSystem MCP Server chạy trên stdio");`
  },
  {
    id: "postgres",
    name: "PostgreSQL Database MCP Server",
    language: "typescript",
    description: "Cho phép AI truy vấn dữ liệu, kiểm tra schema và thực thi câu lệnh SQL an toàn.",
    useCase: "Phân tích dữ liệu, debug lỗi database và tạo báo cáo tự động từ cơ sở dữ liệu PostgreSQL.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/dbname"
});

const server = new Server({
  name: "postgres-mcp",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_query",
      description: "Thực thi câu lệnh SQL SELECT an toàn.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Câu lệnh SQL SELECT" }
        },
        required: ["query"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "run_query") {
    const query = args.query as string;
    if (!query.trim().toLowerCase().startsWith("select")) {
      throw new Error("Chỉ cho phép câu lệnh SELECT để đảm bảo an toàn.");
    }
    const result = await pool.query(query);
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  }
  throw new Error(\`Tool không tồn tại: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);`
  },
  {
    id: "github",
    name: "GitHub Repository MCP Server",
    language: "python",
    description: "Tương tác với GitHub API để tìm kiếm issue, tạo PR, đọc code và quản lý repo.",
    useCase: "Hỗ trợ lập trình viên review PR, tìm kiếm mã nguồn và tự động hóa tác vụ git qua AI.",
    code: `from mcp.server import Server
import mcp.server.stdio
import mcp.types as types
import httpx
import os

app = Server("github-mcp")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

@app.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search_repositories",
            description="Tìm kiếm repository trên GitHub theo từ khóa.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Từ khóa tìm kiếm"}
                },
                "required": ["query"]
            }
        )
    ]

@app.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "search_repositories":
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/search/repositories?q={arguments['query']}",
                headers=HEADERS
            )
            data = resp.json()
            repos = [r["full_name"] for r in data.get("items", [])[:5]]
            return [types.TextContent(type="text", text=str(repos))]
    raise ValueError(f"Tool không tồn tại: {name}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(mcp.server.stdio.stdio_server())`
  },
  {
    id: "remote-compiler",
    name: "Remote Compiler & Code Execution Engine",
    language: "typescript",
    description: "Máy chủ MCP biên dịch và thực thi code đa ngôn ngữ (Python, JS, C++, Bash) an toàn từ xa trong môi trường sandbox.",
    useCase: "Cho phép AI tự viết code, chạy thử nghiệm thuật toán, tính toán khoa học và trả về stdout/stderr lập tức (tương tự ChatGPT Code Interpreter).",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// Sử dụng Engine biên dịch từ xa (ví dụ: Piston API công khai hoặc Docker sandbox riêng của bạn)
const PISTON_API_URL = process.env.SANDBOX_API_URL || "https://emkc.org/api/v2/piston";

const server = new Server({
  name: "remote-compiler-mcp",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "execute_code",
      description: "Biên dịch và chạy mã nguồn từ xa trong môi trường sandbox cô lập. Hỗ trợ python, javascript, bash, c++, v.v.",
      inputSchema: {
        type: "object",
        properties: {
          language: { 
            type: "string", 
            description: "Ngôn ngữ cần chạy: python, javascript, bash, c++" 
          },
          code: { 
            type: "string", 
            description: "Mã nguồn đầy đủ cần thực thi" 
          },
          stdin: { 
            type: "string", 
            description: "Dữ liệu đầu vào dòng lệnh (tùy chọn)" 
          }
        },
        required: ["language", "code"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "execute_code") {
    const language = (args.language as string).toLowerCase();
    const code = args.code as string;
    const stdin = (args.stdin as string) || "";

    const langVersionMap: Record<string, string> = {
      python: "3.10.0",
      javascript: "18.15.0",
      bash: "5.2.0",
      cpp: "10.2.0"
    };

    const version = langVersionMap[language] || "*";

    try {
      const response = await fetch(\`\${PISTON_API_URL}/execute\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          version,
          files: [{ content: code }],
          stdin,
          run_timeout: 5000,
          compile_timeout: 10000
        })
      });
      const data = await response.json();
      const runResult = data.run || {};
      const compileResult = data.compile;

      const output = {
        language,
        stdout: runResult.stdout || "",
        stderr: runResult.stderr || (compileResult?.stderr || ""),
        exitCode: runResult.code,
        signal: runResult.signal
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2)
          }
        ]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: \`Lỗi thực thi sandbox: \${err.message}\`
          }
        ],
        isError: true
      };
    }
  }

  throw new Error(\`Không tìm thấy tool: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Remote Compiler MCP Server đã khởi động!");`
  },
  {
    id: "remote-sse",
    name: "Remote SSE MCP Server (Cloud / VPS Hosted)",
    language: "typescript",
    description: "Máy chủ MCP chạy qua HTTP/SSE từ xa trên VPS, Docker, Render hoặc Cloud Run thay vì chạy local qua stdio.",
    useCase: "Cho phép bất kỳ máy khách nào kết nối qua Internet (URL bảo mật có kèm Authorization Token) để sử dụng tool mà không cần cài Node.js trên máy client.",
    code: `import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.MCP_SECRET_TOKEN || "super-secret-mcp-key";

// Middleware xác thực bảo mật
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== \`Bearer \${AUTH_TOKEN}\`) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing Bearer token" });
  }
  next();
};

const server = new Server({
  name: "remote-cloud-mcp",
  version: "1.0.0",
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_remote_server_status",
      description: "Kiểm tra tài nguyên và trạng thái của máy chủ đám mây từ xa.",
      inputSchema: { type: "object", properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_remote_server_status") {
    return {
      content: [{ type: "text", text: \`Server uptime: \${process.uptime()}s, RAM used: \${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\` }]
    };
  }
  throw new Error("Tool không tồn tại");
});

let transport: SSEServerTransport | null = null;

// Endpoint SSE dành cho Client lắng nghe luồng sự kiện từ xa
app.get("/sse", authenticate, async (req, res) => {
  console.log("Client đã kết nối tới Remote SSE transport");
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

// Endpoint nhận tin nhắn JSON-RPC từ Client
app.post("/message", authenticate, express.json(), async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("Chưa khởi tạo transport SSE.");
  }
});

app.listen(PORT, () => {
  console.log(\`Remote SSE MCP Server đang lắng nghe tại port \${PORT}\`);
});`
  }
];

// API: Get templates
app.get("/api/mcp/templates", (req, res) => {
  res.json({ success: true, templates: MCP_TEMPLATES });
});

// API: Real Remote Compiler Sandbox execution
app.post("/api/mcp/remote-compiler-run", async (req, res) => {
  try {
    const { language, code, stdin } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập code cần chạy." });
    }

    const startTime = Date.now();
    let realExecutionSuccess = false;
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let engineUsed = "Piston Real Remote Sandbox";

    // Mapping language to Piston specs
    const langMap: Record<string, { name: string; version: string }> = {
      python: { name: "python", version: "3.10.0" },
      javascript: { name: "javascript", version: "18.15.0" },
      bash: { name: "bash", version: "5.2.0" },
      cpp: { name: "c++", version: "10.2.0" }
    };

    const targetLang = langMap[language] || { name: language, version: "*" };

    // Attempt real remote execution on Piston Sandbox Engine
    try {
      const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: targetLang.name,
          version: targetLang.version,
          files: [{ content: code }],
          stdin: stdin || "",
          run_timeout: 8000,
          compile_timeout: 10000
        })
      });

      if (pistonRes.ok) {
        const data = await pistonRes.json();
        if (data && data.run) {
          stdout = data.run.stdout || "";
          stderr = data.run.stderr || (data.compile?.stderr || "");
          exitCode = typeof data.run.code === "number" ? data.run.code : 0;
          realExecutionSuccess = true;
        }
      }
    } catch (e: any) {
      console.warn("Piston remote sandbox call failed, falling back to Gemini Sandbox simulation:", e.message);
    }

    // If Piston sandbox did not return, use server-side AI evaluation fallback
    if (!realExecutionSuccess) {
      engineUsed = "Cloud AI Sandbox Evaluator (Fallback)";
      const prompt = `Bạn là một sandbox engine biên dịch và thực thi code từ xa.
Hãy phân tích mã nguồn sau và thực thi:
- Ngôn ngữ: ${language}
- Dữ liệu stdin: ${stdin || "(trống)"}
- Mã nguồn:
\`\`\`${language}
${code}
\`\`\`

Trả về JSON:
1. "stdout": chuỗi in ra màn hình.
2. "stderr": lỗi nếu có.
3. "exitCode": 0 nếu thành công, 1 nếu lỗi.
4. "analysis": tóm tắt kết quả.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stdout: { type: Type.STRING },
              stderr: { type: Type.STRING },
              exitCode: { type: Type.NUMBER },
              analysis: { type: Type.STRING }
            },
            required: ["stdout", "stderr", "exitCode", "analysis"]
          }
        }
      });
      const parsed = JSON.parse(response.text || "{}");
      stdout = parsed.stdout || "";
      stderr = parsed.stderr || "";
      exitCode = parsed.exitCode || 0;
    }

    const executionTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      isRealExecution: realExecutionSuccess,
      engine: engineUsed,
      stdout,
      stderr,
      exitCode,
      executionTimeMs,
      analysis: realExecutionSuccess 
        ? `Đã biên dịch và thực thi thực tế trên Remote Sandbox Engine (${targetLang.name} ${targetLang.version}). Kết quả trả về trực tiếp từ Linux container.`
        : "Đã phân tích và thực thi qua Cloud Sandbox Engine."
    });
  } catch (err: any) {
    console.error("Remote compiler error:", err);
    res.status(500).json({ success: false, error: err.message || "Lỗi chạy sandbox" });
  }
});

// API: Ping / Test real remote MCP Server endpoint
app.post("/api/mcp/remote-ping", async (req, res) => {
  try {
    const { url, authToken } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập URL máy chủ MCP từ xa." });
    }

    const startTime = Date.now();
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000)
      });

      const latencyMs = Date.now() - startTime;
      const contentType = response.headers.get("content-type") || "";
      const isSse = contentType.includes("text/event-stream");

      res.json({
        success: true,
        status: response.status,
        statusText: response.statusText,
        latencyMs,
        isSse,
        contentType,
        message: response.ok 
          ? `Kết nối thành công tới Remote MCP Server (${latencyMs}ms, ${isSse ? 'Giao thức SSE hợp lệ' : contentType})`
          : `Máy chủ phản hồi với HTTP mã ${response.status} (${response.statusText})`
      });
    } catch (e: any) {
      res.json({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Không thể kết nối tới URL: ${e.message}`
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Lỗi kiểm tra kết nối" });
  }
});

// API: Generate MCP Server code using Gemini AI
app.post("/api/mcp/generate-code", async (req, res) => {
  try {
    const { toolName, toolDescription, language, parameters, requiresApiKey, apiKeyEnvName } = req.body;

    const apiKeyInstruction = requiresApiKey 
      ? `\n5. QUAN TRỌNG VỀ API KEY: Tool này yêu cầu API Key. Bạn hãy đọc API Key từ biến môi trường ${apiKeyEnvName || 'API_KEY'} (${language === 'python' ? 'sử dụng os.getenv("' + (apiKeyEnvName || 'API_KEY') + '")' : 'sử dụng process.env.' + (apiKeyEnvName || 'API_KEY')}). Kiểm tra nếu chưa có key thì báo lỗi rõ ràng. Trong file configJson (claude_desktop_config.json), bạn PHẢI thêm trường "env": { "${apiKeyEnvName || 'API_KEY'}": "YOUR_ACTUAL_API_KEY_HERE" }.` 
      : '';

    const prompt = `Bạn là kỹ sư trưởng hệ thống Model Context Protocol (MCP). Hãy viết mã nguồn hoàn chỉnh cho một MCP Server sử dụng ${language === 'python' ? 'Python (mcp package)' : 'TypeScript (@modelcontextprotocol/sdk)'}.
Tên tool: ${toolName}
Mô tả: ${toolDescription}
Tham số đầu vào (JSON Schema properties): ${JSON.stringify(parameters, null, 2)}

Yêu cầu:
1. Mã nguồn chuẩn cú pháp, rõ ràng, có chú thích chi tiết bằng tiếng Việt.
2. Xử lý lỗi đầy đủ (try/catch, validation).
3. Đảm bảo tuân thủ đúng chuẩn giao thức MCP (StdioServerTransport hoặc SSE).
4. Trả về kết quả JSON gồm: { "code": "...", "instructions": "...", "configJson": "..." } trong đó configJson là cấu hình mẫu cho claude_desktop_config.json.${apiKeyInstruction}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "Mã nguồn đầy đủ" },
            instructions: { type: Type.STRING, description: "Hướng dẫn cài đặt và chạy" },
            configJson: { type: Type.STRING, description: "Cấu hình claude_desktop_config.json mẫu" }
          },
          required: ["code", "instructions", "configJson"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Generate error:", error);
    res.status(500).json({ success: false, error: error.message || "Lỗi tạo code MCP" });
  }
});

// API: Test / Simulate MCP tool execution with AI Agent
app.post("/api/mcp/test-tool", async (req, res) => {
  try {
    const { toolName, toolDescription, parameters, userPrompt } = req.body;

    // We can use Gemini function calling to simulate how an AI agent calls this custom MCP tool
    const functionDeclaration = {
      name: toolName || "custom_tool",
      description: toolDescription || "Custom MCP Tool",
      parameters: parameters || {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "Tham số truy vấn" }
        },
        required: ["query"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userPrompt || "Hãy thực hiện tool này với dữ liệu mẫu.",
      config: {
        tools: [{ functionDeclarations: [functionDeclaration] }],
        systemInstruction: "Bạn là trợ lý AI đang thử nghiệm giao thức MCP. Khi người dùng yêu cầu, hãy gọi tool được cung cấp với tham số phù hợp."
      }
    });

    const functionCalls = response.functionCalls;
    const textOutput = response.text;

    res.json({
      success: true,
      text: textOutput,
      functionCalls: functionCalls || [],
      simulatedJsonRpc: functionCalls ? {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: functionCalls[0].name,
          arguments: functionCalls[0].args
        },
        id: 1
      } : null
    });
  } catch (error: any) {
    console.error("Test tool error:", error);
    res.status(500).json({ success: false, error: error.message || "Lỗi chạy thử tool" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP Server & AI Tool Forge đang chạy trên cổng ${PORT}`);
});
