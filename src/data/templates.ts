export interface Template {
  id: string;
  name: string;
  language: string;
  description: string;
  useCase: string;
  code: string;
  configJson?: string;
}

export const DEFAULT_MCP_TEMPLATES: Template[] = [
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
    # Cảnh báo nếu chưa thiết lập trong claude_desktop_config.json
    print("[CẢNH BÁO] Chưa tìm thấy WEATHER_API_KEY trong biến môi trường. Vui lòng cấu hình trong file json của Claude Desktop.")

# Constants
WEATHER_API_BASE = "https://api.weatherapi.com/v1" # hoặc OpenWeatherMap / NWS
USER_AGENT = "weather-mcp-app/1.0"

# Header kèm API Key bảo mật
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
        "key": WEATHER_API_KEY,  # Truyền API Key an toàn trong query param hoặc header
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

@mcp.tool()
async def get_forecast(city: str, days: int = 3) -> str:
    """Lấy dự báo thời tiết cho các ngày tới.
    
    Args:
        city: Tên thành phố
        days: Số ngày dự báo (mặc định: 3 ngày)
    """
    if not WEATHER_API_KEY:
        return "Lỗi: Thiếu WEATHER_API_KEY."

    url = f"{WEATHER_API_BASE}/forecast.json"
    params = {
        "key": WEATHER_API_KEY,
        "q": city,
        "days": days
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=HEADERS, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            forecast_days = data.get("forecast", {}).get("forecastday", [])
            
            output = [f"Dự báo thời tiết {city} ({days} ngày):"]
            for f in forecast_days:
                date = f.get("date")
                day = f.get("day", {})
                cond = day.get("condition", {}).get("text")
                output.append(f"- {date}: {day.get('avgtemp_c')}°C, {cond}, mưa: {day.get('daily_chance_of_rain')}%")
            return "\\n".join(output)
        except Exception as e:
            return f"Lỗi lấy dự báo: {str(e)}"

if __name__ == "__main__":
    # Khởi chạy MCP Server qua giao thức stdio
    mcp.run(transport="stdio")`,
    configJson: `{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": [
        "--directory",
        "/DUONG_DAN_TUYET_DOI/TO/weather",
        "run",
        "weather.py"
      ],
      "env": {
        "WEATHER_API_KEY": "YOUR_ACTUAL_API_KEY_HERE"
      }
    }
  }
}`
  },
  {
    id: "remote-compiler",
    name: "Remote Compiler & Code Execution Engine",
    language: "typescript",
    description: "Máy chủ MCP biên dịch và thực thi code đa ngôn ngữ (Python, JS, C++, Bash) an toàn từ xa trong môi trường sandbox.",
    useCase: "Cho phép AI tự viết code, chạy thử nghiệm thuật toán, tính toán khoa học và trả về stdout/stderr lập tức.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

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
          language: { type: "string", description: "python, javascript, bash, c++" },
          code: { type: "string", description: "Mã nguồn đầy đủ" },
          stdin: { type: "string", description: "Dữ liệu đầu vào dòng lệnh (tùy chọn)" }
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

    const response = await fetch(\`\${PISTON_API_URL}/execute\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ content: code }],
        stdin,
        run_timeout: 8000,
        compile_timeout: 10000
      })
    });
    const data = await response.json();
    return {
      content: [{ type: "text", text: data.run?.stdout || data.run?.stderr || "Executed" }]
    };
  }
  throw new Error(\`Tool không tồn tại: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);`,
    configJson: `{
  "mcpServers": {
    "remote-compiler": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}`
  },
  {
    id: "remote-sse",
    name: "Remote SSE MCP Server (Cloud / VPS Hosted)",
    language: "typescript",
    description: "Máy chủ MCP chạy qua HTTP/SSE từ xa trên VPS, Docker hoặc Cloud Run với Bearer Token xác thực.",
    useCase: "Cho phép client kết nối qua Internet với URL an toàn kèm Authorization Token.",
    code: `import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.MCP_SECRET_TOKEN || "super-secret-mcp-key";

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

app.get("/sse", authenticate, async (req, res) => {
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post("/message", authenticate, express.json(), async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("Chưa khởi tạo transport SSE.");
  }
});

app.listen(PORT, () => {
  console.log(\`Remote SSE MCP Server đang lắng nghe tại port \${PORT}\`);
});`,
    configJson: `{
  "mcpServers": {
    "cloud-mcp": {
      "url": "https://your-cloud-domain.com/sse",
      "headers": {
        "Authorization": "Bearer super-secret-mcp-key"
      }
    }
  }
}`
  },
  {
    id: "filesystem",
    name: "File System MCP Server",
    language: "typescript",
    description: "Cho phép AI đọc, ghi, tìm kiếm và liệt kê tệp tin trong thư mục cho phép.",
    useCase: "Giúp Claude Desktop hoặc Cursor duyệt code, đọc tài liệu và chỉnh sửa file an toàn.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_DIR = process.env.MCP_ALLOWED_DIR || process.cwd();

const server = new Server({
  name: "filesystem-mcp",
  version: "1.0.0",
}, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "Đọc nội dung tệp tin",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "read_file") {
    const targetPath = path.resolve(ALLOWED_DIR, args.path as string);
    const data = await fs.readFile(targetPath, 'utf8');
    return { content: [{ type: "text", text: data }] };
  }
  throw new Error(\`Tool không tồn tại: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);`,
    configJson: `{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "MCP_ALLOWED_DIR": "/Users/you/projects"
      }
    }
  }
}`
  },
  {
    id: "postgres",
    name: "PostgreSQL Database MCP Server",
    language: "typescript",
    description: "Cho phép AI truy vấn dữ liệu, kiểm tra schema và thực thi câu lệnh SQL an toàn.",
    useCase: "Phân tích dữ liệu, debug database và tạo báo cáo tự động từ PostgreSQL.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const server = new Server({
  name: "postgres-mcp",
  version: "1.0.0",
}, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_query",
      description: "Thực thi câu lệnh SQL SELECT an toàn.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
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
  throw new Error("Tool không tồn tại");
});

const transport = new StdioServerTransport();
await server.connect(transport);`,
    configJson: `{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}`
  }
];
