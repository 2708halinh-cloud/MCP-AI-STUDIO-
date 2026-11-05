import React, { useState, useEffect } from 'react';
import { 
  Terminal, Cpu, BookOpen, Code, Play, CheckCircle2, Copy, 
  ArrowRight, Settings, Database, Server, GitBranch, Layers, 
  Sparkles, RefreshCw, Check, FileText, Wrench, Shield, Zap,
  HelpCircle, ChevronRight, ExternalLink, Globe, Lock, Clock, AlertTriangle,
  History, Trash2, Radio, Activity, Search, X, Filter
} from 'lucide-react';
import { db, auth } from './lib/firebase.ts';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

interface Template {
  id: string;
  name: string;
  language: string;
  description: string;
  useCase: string;
  code: string;
}

interface ExecutionHistoryItem {
  id: string;
  language: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  engine: string;
  createdAt: string;
}

interface RemoteServerItem {
  id: string;
  name: string;
  url: string;
  transport: string;
  authToken?: string;
  status: string;
}

interface ServerHealthStatus {
  status: 'online' | 'offline' | 'checking';
  latencyMs?: number;
  lastChecked?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "nws-weather",
    name: "Python NWS & Weather API (Chuẩn Người Dùng)",
    language: "python",
    description: "Mẫu máy chủ MCP thời tiết chính xác theo cấu trúc của bạn (api.weather.gov), tích hợp kỹ thuật cấu hình API Key qua biến môi trường 'WEATHER_API_KEY' và custom User-Agent.",
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
    id: "weather-apikey",
    name: "Python Weather MCP Server (WeatherAPI + os.getenv)",
    language: "python",
    description: "Máy chủ MCP Python sử dụng httpx để gọi WeatherAPI, tích hợp bảo mật API Key qua biến môi trường (Environment Variables) trong claude_desktop_config.json.",
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
    id: "remote-compiler",
    name: "Remote Compiler MCP Server (Code Sandbox)",
    language: "typescript",
    description: "Máy chủ MCP cung cấp công cụ 'execute_code' cho AI để chạy thử nghiệm mã nguồn (Python, JS, Bash, C++) trong môi trường Piston Sandbox cách ly an toàn.",
    useCase: "Biến AI thành lập trình viên tự động kiểm thử code thực tế trên server mà không gây rủi ro cho máy tính của bạn.",
    code: `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const PISTON_API_URL = process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston";

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
          language: { type: "string", description: "Ngôn ngữ cần chạy: python, javascript, bash, c++" },
          code: { type: "string", description: "Mã nguồn đầy đủ cần thực thi" },
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
    try {
      const response = await fetch(\`\${PISTON_API_URL}/execute\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          version: "*",
          files: [{ content: code }],
          stdin,
          run_timeout: 5000,
          compile_timeout: 10000
        })
      });
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data.run || {}, null, 2) }]
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: \`Lỗi thực thi sandbox: \${err.message}\` }],
        isError: true
      };
    }
  }
  throw new Error(\`Không tìm thấy tool: \${name}\`);
});

const transport = new StdioServerTransport();
await server.connect(transport);`
  },
  {
    id: "remote-sse",
    name: "Remote SSE MCP Server (Cloud Hosted)",
    language: "typescript",
    description: "Máy chủ MCP chạy qua HTTP/SSE từ xa trên VPS, Docker, Render hoặc Cloud Run thay vì chạy local qua stdio.",
    useCase: "Cho phép máy khách kết nối qua Internet (URL bảo mật có kèm Authorization Token) để sử dụng tool từ xa.",
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
});`
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'remote-compiler' | 'remote-servers' | 'vector-db' | 'roadmap' | 'architecture' | 'generator' | 'playground' | 'templates'>('remote-compiler');
  
  // Remote Compiler Studio State
  const [compilerLang, setCompilerLang] = useState<'python' | 'javascript' | 'bash' | 'cpp'>('python');
  const [compilerCode, setCompilerCode] = useState<string>(`# Thuật toán tính dãy Fibonacci và phân tích hiệu năng
def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

numbers = fibonacci(12)
print("Kết quả 12 số Fibonacci đầu tiên:")
print(numbers)
print(f"Tổng các số: {sum(numbers)}")
`);
  const [compilerStdin, setCompilerStdin] = useState<string>('');
  const [isRunningCompiler, setIsRunningCompiler] = useState(false);
  const [compilerOutput, setCompilerOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    analysis: string;
    executionTimeMs: number;
    engine?: string;
    isRealExecution?: boolean;
  } | null>(null);

  // Firestore execution history
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Remote servers state
  const [serverList, setServerList] = useState<RemoteServerItem[]>([]);
  const [newServerName, setNewServerName] = useState('VPS Production MCP Server');
  const [newServerUrl, setNewServerUrl] = useState('https://mcp.yourdomain.com/sse');
  const [newServerToken, setNewServerToken] = useState('secret-mcp-bearer-token');
  const [pingResult, setPingResult] = useState<any>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Health Dashboard state
  const [healthStatuses, setHealthStatuses] = useState<Record<string, ServerHealthStatus>>({});
  const [isCheckingAllHealth, setIsCheckingAllHealth] = useState(false);

  const checkAllServersHealth = async () => {
    if (serverList.length === 0) return;
    setIsCheckingAllHealth(true);
    
    const newStatuses: Record<string, ServerHealthStatus> = {};
    serverList.forEach(srv => {
      newStatuses[srv.id] = { status: 'checking', lastChecked: new Date().toLocaleTimeString('vi-VN') };
    });
    setHealthStatuses(prev => ({ ...prev, ...newStatuses }));

    for (const server of serverList) {
      try {
        const res = await fetch('/api/mcp/remote-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: server.url, authToken: server.authToken })
        });
        const data = await res.json();
        setHealthStatuses(prev => ({
          ...prev,
          [server.id]: {
            status: data.success && data.status < 500 ? 'online' : 'offline',
            latencyMs: data.latencyMs || 0,
            lastChecked: new Date().toLocaleTimeString('vi-VN')
          }
        }));
      } catch (err) {
        setHealthStatuses(prev => ({
          ...prev,
          [server.id]: {
            status: 'offline',
            lastChecked: new Date().toLocaleTimeString('vi-VN')
          }
        }));
      }
    }
    setIsCheckingAllHealth(false);
  };

  useEffect(() => {
    if (serverList.length > 0) {
      checkAllServersHealth();
      const interval = setInterval(() => {
        checkAllServersHealth();
      }, 30000); // every 30s
      return () => clearInterval(interval);
    }
  }, [serverList.length]);

  // Generator state
  const [toolName, setToolName] = useState('get_weather_forecast');
  const [toolDesc, setToolDesc] = useState('Tra cứu dự báo thời tiết cho địa điểm cụ thể, yêu cầu bảo mật API Key.');
  const [language, setLanguage] = useState('python');
  const [argName, setArgName] = useState('city');
  const [argType, setArgType] = useState('string');
  const [argDesc, setArgDesc] = useState('Tên thành phố cần tra cứu (ví dụ: Hanoi, Tokyo)');
  const [requiresApiKey, setRequiresApiKey] = useState(true);
  const [apiKeyEnvName, setApiKeyEnvName] = useState('WEATHER_API_KEY');
  
  const [generatedResult, setGeneratedResult] = useState<{ code: string; instructions: string; configJson: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Playground state
  const [testPrompt, setTestPrompt] = useState('Hãy dự báo thời tiết cho thành phố Hà Nội.');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(DEFAULT_TEMPLATES[0]);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [templateLanguageFilter, setTemplateLanguageFilter] = useState<'all' | 'python' | 'typescript'>('all');

  const filteredTemplates = templates.filter(tmpl => {
    const q = templateSearchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      tmpl.name.toLowerCase().includes(q) ||
      tmpl.language.toLowerCase().includes(q) ||
      tmpl.description.toLowerCase().includes(q) ||
      tmpl.useCase.toLowerCase().includes(q) ||
      tmpl.id.toLowerCase().includes(q);

    const matchesLang = templateLanguageFilter === 'all' || tmpl.language.toLowerCase() === templateLanguageFilter.toLowerCase();
    return matchesQuery && matchesLang;
  });

  // Load templates & history
  useEffect(() => {
    fetch('/api/mcp/templates')
      .then(async res => {
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return null;
        return res.json();
      })
      .then(data => {
        if (data && data.success && Array.isArray(data.templates) && data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplate(data.templates.find((t: Template) => t.id === 'nws-weather') || data.templates[0]);
        }
      })
      .catch(err => {
        console.warn("Using offline templates fallback:", err);
      });

    loadExecutionHistory();
    loadRemoteServers();
  }, []);

  const loadExecutionHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(collection(db, 'executions'), orderBy('createdAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      const items: ExecutionHistoryItem[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          language: data.language || '',
          code: data.code || '',
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode ?? 0,
          executionTimeMs: data.executionTimeMs ?? 0,
          engine: data.engine || 'Remote Sandbox',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });
      setExecutionHistory(items);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.LIST, 'executions');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadRemoteServers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'remote_servers'));
      const list: RemoteServerItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || 'Unnamed',
          url: d.url || '',
          transport: d.transport || 'sse',
          authToken: d.authToken,
          status: d.status || 'active'
        });
      });
      if (list.length === 0) {
        // Sample starter item
        setServerList([
          {
            id: 'sample-1',
            name: 'Piston Engine Sandbox Server',
            url: 'https://emkc.org/api/v2/piston',
            transport: 'http',
            status: 'active'
          }
        ]);
      } else {
        setServerList(list);
      }
    } catch (e: any) {
      handleFirestoreError(e, OperationType.LIST, 'remote_servers');
    }
  };

  const handleRunCompiler = async () => {
    setIsRunningCompiler(true);
    setCompilerOutput(null);
    try {
      const res = await fetch('/api/mcp/remote-compiler-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: compilerLang,
          code: compilerCode,
          stdin: compilerStdin
        })
      });
      const data = await res.json();
      if (data.success) {
        setCompilerOutput(data);

        // Save real execution log to Firestore for persistence
        try {
          await addDoc(collection(db, 'executions'), {
            language: compilerLang,
            code: compilerCode,
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            exitCode: data.exitCode ?? 0,
            executionTimeMs: data.executionTimeMs ?? 0,
            engine: data.engine || 'Piston Real Remote Sandbox',
            createdAt: new Date().toISOString()
          });
          loadExecutionHistory();
        } catch (dbErr: any) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'executions');
        }
      } else {
        alert("Lỗi thực thi: " + data.error);
      }
    } catch (err: any) {
      alert("Lỗi kết nối máy chủ compiler: " + err.message);
    } finally {
      setIsRunningCompiler(false);
    }
  };

  const handlePingServer = async (urlToPing: string, tokenToPing?: string) => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/mcp/remote-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToPing,
          authToken: tokenToPing
        })
      });
      const data = await res.json();
      setPingResult(data);
    } catch (e: any) {
      setPingResult({ success: false, error: e.message });
    } finally {
      setIsPinging(false);
    }
  };

  const handleAddRemoteServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'remote_servers'), {
        name: newServerName,
        url: newServerUrl,
        authToken: newServerToken,
        transport: 'sse',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setServerList(prev => [...prev, {
        id: docRef.id,
        name: newServerName,
        url: newServerUrl,
        transport: 'sse',
        authToken: newServerToken,
        status: 'active'
      }]);
      alert("Đã lưu máy chủ MCP từ xa thành công vào Firestore!");
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'remote_servers');
      alert("Lỗi lưu vào Firestore: " + e.message);
    }
  };

  const handleDeleteServer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'remote_servers', id));
      setServerList(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `remote_servers/${id}`);
    }
  };

  const handleLanguagePresetChange = (lang: 'python' | 'javascript' | 'bash' | 'cpp') => {
    setCompilerLang(lang);
    if (lang === 'python') {
      setCompilerCode(`# Thuật toán tính dãy Fibonacci và phân tích hiệu năng
def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

numbers = fibonacci(12)
print("Kết quả 12 số Fibonacci đầu tiên:")
print(numbers)
print(f"Tổng các số: {sum(numbers)}")
`);
    } else if (lang === 'javascript') {
      setCompilerCode(`// Thao tác phân tích dữ liệu mảng và thời gian thực thi
const data = [
  { id: 1, name: "Sản phẩm A", price: 120000, quantity: 3 },
  { id: 2, name: "Sản phẩm B", price: 450000, quantity: 1 },
  { id: 3, name: "Sản phẩm C", price: 85000, quantity: 5 }
];

const totalRevenue = data.reduce((acc, item) => acc + (item.price * item.quantity), 0);
console.log("Chi tiết đơn hàng:");
console.table(data);
console.log("Tổng doanh thu: " + totalRevenue.toLocaleString('vi-VN') + " VND");
`);
    } else if (lang === 'bash') {
      setCompilerCode(`#!/bin/bash
# Kiểm tra thông số giả lập hệ thống sandbox
echo "=== THÔNG TIN MÔI TRƯỜNG SANDBOX REMOTE ==="
echo "Hệ điều hành: Linux x86_64"
echo "Thời gian máy chủ: $(date)"
echo "Số lõi CPU khả dụng: $(nproc 2>/dev/null || echo 4)"
echo "Trạng thái cô lập: Đã kích hoạt chroot / docker cgroups"
echo "Hoàn thành kiểm tra an toàn!"
`);
    } else if (lang === 'cpp') {
      setCompilerCode(`#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> v = {10, 20, 30, 40, 50};
    int total = std::accumulate(v.begin(), v.end(), 0);
    
    std::cout << "Remote C++ Compiler Sandbox!" << std::endl;
    std::cout << "Tong cac phan tu: " << total << std::endl;
    return 0;
}
`);
    }
  };

  const loadWeatherApiKeyPreset = () => {
    setCompilerLang('python');
    setCompilerCode(`# Mẫu kiểm tra MCP Server thời tiết & API Key an toàn trong Sandbox
import os
import json

# 1. Giả lập nạp biến môi trường từ cấu hình Claude Desktop (claude_desktop_config.json)
# Trong môi trường thực tế, Claude Desktop tự động truyền vào mà không cần code này!
os.environ["WEATHER_API_KEY"] = "sk_weather_demo_secure_key_998877"

# 2. Đọc biến môi trường an toàn theo chuẩn MCP:
api_key = os.getenv("WEATHER_API_KEY")

print("=== KIỂM TRA MÁY CHỦ MCP THỜI TIẾT & API KEY ===")
if not api_key:
    print("❌ LỖI: Chưa tìm thấy WEATHER_API_KEY trong biến môi trường!")
    print("👉 Hướng dẫn: Thêm trường \\"env\\": { \\"WEATHER_API_KEY\\": \\"...\\" } vào file cấu hình.")
else:
    masked_key = api_key[:4] + "****" + api_key[-4:]
    print(f"✅ 1. Đã nhận diện API Key an toàn: {masked_key}")
    print("✅ 2. Giao thức HTTP Headers được tạo:")
    headers = {
        "User-Agent": "weather-mcp/1.0",
        "Authorization": f"Bearer {masked_key}",
        "Accept": "application/json"
    }
    print(json.dumps(headers, indent=2))
    print("✅ 3. Trạng thái bảo mật: TUYỆT ĐỐI KHÔNG để lộ Key cho mô hình LLM!")
    print("✅ 4. AI chỉ nhận được kết quả nhiệt độ/dự báo thời tiết sau khi tool thực thi xong.")
`);
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGeneratedResult(null);
    try {
      const res = await fetch('/api/mcp/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          toolDescription: toolDesc,
          language,
          requiresApiKey,
          apiKeyEnvName,
          parameters: {
            type: "object",
            properties: {
              [argName]: { type: argType, description: argDesc }
            },
            required: [argName]
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedResult(data);
      } else {
        alert("Lỗi: " + data.error);
      }
    } catch (err: any) {
      alert("Không thể kết nối đến server: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/mcp/test-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          toolDescription: toolDesc,
          userPrompt: testPrompt,
          parameters: {
            type: "object",
            properties: {
              [argName]: { type: argType, description: argDesc }
            },
            required: [argName]
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data);
      } else {
        alert("Lỗi: " + data.error);
      }
    } catch (err: any) {
      alert("Lỗi kiểm tra tool: " + err.message);
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract: Wordmark — Nav Links — Primary Action */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900">MCP Forge</span>
            <span className="text-xs text-slate-500 block font-normal">Real Remote Compiler & AI Tools Studio</span>
          </div>
        </a>

        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button 
            onClick={() => setActiveTab('remote-compiler')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${activeTab === 'remote-compiler' ? 'text-slate-900 font-bold border-b-2 border-emerald-500' : 'hover:text-slate-900'}`}
          >
            <Cpu className="w-4 h-4 text-emerald-500" />
            <span>Remote Compiler Thật</span>
          </button>
          <button 
            onClick={() => setActiveTab('remote-servers')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${activeTab === 'remote-servers' ? 'text-slate-900 font-bold border-b-2 border-emerald-500' : 'hover:text-slate-900'}`}
          >
            <Globe className="w-4 h-4 text-indigo-500" />
            <span>Quản Lý Server Từ Xa (SSE)</span>
          </button>
          <button 
            onClick={() => setActiveTab('vector-db')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${activeTab === 'vector-db' ? 'text-slate-900 font-bold border-b-2 border-emerald-500' : 'hover:text-slate-900'}`}
          >
            <Database className="w-4 h-4 text-amber-500" />
            <span>Vector DB & Google Drive</span>
          </button>
          <button 
            onClick={() => setActiveTab('roadmap')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${activeTab === 'roadmap' ? 'text-slate-900 font-bold border-b-2 border-slate-900' : 'hover:text-slate-900'}`}
          >
            Lộ Trình Chuẩn Bị
          </button>
          <button 
            onClick={() => setActiveTab('architecture')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${activeTab === 'architecture' ? 'text-slate-900 font-bold border-b-2 border-slate-900' : 'hover:text-slate-900'}`}
          >
            Kiến Trúc & Giao Thức
          </button>
          <button 
            onClick={() => setActiveTab('generator')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${activeTab === 'generator' ? 'text-slate-900 font-bold border-b-2 border-slate-900' : 'hover:text-slate-900'}`}
          >
            Trình Tạo Code MCP
          </button>
          <button 
            onClick={() => setActiveTab('templates')} 
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${activeTab === 'templates' ? 'text-slate-900 font-bold border-b-2 border-slate-900' : 'hover:text-slate-900'}`}
          >
            Kho Mẫu Sẵn Sàng
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setActiveTab('remote-compiler')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Chạy Remote Sandbox</span>
          </button>
        </div>
      </header>

      {/* Mobile Subheader Navigation */}
      <div className="xl:hidden flex overflow-x-auto bg-white border-b border-slate-200 px-4 py-2.5 gap-2 text-xs font-medium text-slate-600 no-scrollbar">
        <button onClick={() => setActiveTab('remote-compiler')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1 ${activeTab === 'remote-compiler' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-100'}`}>
          <Cpu className="w-3.5 h-3.5" />
          <span>Remote Compiler</span>
        </button>
        <button onClick={() => setActiveTab('remote-servers')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1 ${activeTab === 'remote-servers' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100'}`}>
          <Globe className="w-3.5 h-3.5" />
          <span>Server Từ Xa</span>
        </button>
        <button onClick={() => setActiveTab('vector-db')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg flex items-center gap-1 ${activeTab === 'vector-db' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100'}`}>
          <Database className="w-3.5 h-3.5" />
          <span>Vector DB</span>
        </button>
        <button onClick={() => setActiveTab('roadmap')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${activeTab === 'roadmap' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Lộ Trình</button>
        <button onClick={() => setActiveTab('architecture')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${activeTab === 'architecture' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Kiến Trúc</button>
        <button onClick={() => setActiveTab('generator')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${activeTab === 'generator' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Tạo Code</button>
        <button onClick={() => setActiveTab('templates')} className={`whitespace-nowrap px-3 py-1.5 rounded-lg ${activeTab === 'templates' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Kho Mẫu</button>
      </div>

      {/* Hero / Header intro */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white py-10 px-6 lg:px-16 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span>Real Remote Engine & Cloud Persistence (Firestore Active)</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Remote Compiler & Máy Chủ MCP Thật Cho AI
            </h1>
            <p className="text-slate-300 text-sm lg:text-base leading-relaxed">
              Thực thi mã nguồn thực tế trên **Remote Linux Sandbox Engine (Piston)**, kết nối và kiểm tra **Remote MCP Server (SSE / HTTP)** trực tiếp, và tự động lưu trữ cấu hình trên cơ sở dữ liệu đám mây Firestore.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button 
                onClick={() => setActiveTab('remote-compiler')} 
                className="px-4 py-2.5 text-xs font-bold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Cpu className="w-4 h-4" />
                <span>Chạy Code Trên Remote Sandbox Thật</span>
              </button>
              <button 
                onClick={() => setActiveTab('remote-servers')} 
                className="px-4 py-2.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Globe className="w-4 h-4" />
                <span>Kiểm Tra Remote Server (Ping SSE)</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 p-6 rounded-2xl shadow-xl w-full lg:w-96 shrink-0 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Radio className="w-4 h-4" />
                <span>Real Sandbox Status</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-sans font-medium">Online</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Sandbox Backend:</span>
                <span className="text-emerald-300 font-semibold">Piston Linux Container</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Database Storage:</span>
                <span className="text-white">Firestore Cloud DB</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Execution Mode:</span>
                <span className="text-emerald-400 font-bold">100% Thực Tế (No Mock)</span>
              </div>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg text-[11px] text-slate-300 border border-slate-800">
              <span className="text-slate-500 block mb-1">Cơ chế bảo mật:</span>
              <span className="text-slate-300">Isolate cgroups · No network in sandbox · Auto-kill 8s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">

        {/* TAB 1: REMOTE COMPILER (REAL SANDBOX) */}
        {activeTab === 'remote-compiler' && (
          <div className="space-y-10">
            {/* Real Engine Notice */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Môi Trường Remote Compiler Thật 100%</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Mã nguồn được gửi đến máy chủ Linux container thật để biên dịch và chạy bằng Piston Engine API. Kết quả được lưu tự động vào Cloud Firestore.
                  </p>
                </div>
              </div>
              <button 
                onClick={loadExecutionHistory}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>Cập nhật lịch sử</span>
              </button>
            </div>

            {/* Interactive Live Sandbox Runner */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-600" />
                    <span>Trình Biên Dịch & Chạy Code Thực Tế (Real Remote Sandbox)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hỗ trợ Python 3, Node.js, Bash và C++. AI có thể gọi tool này để thực thi code từ xa.
                  </p>
                </div>

                {/* Language Selectors & Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => handleLanguagePresetChange('python')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${compilerLang === 'python' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Python 3
                    </button>
                    <button 
                      onClick={() => handleLanguagePresetChange('javascript')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${compilerLang === 'javascript' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      JavaScript (Node)
                    </button>
                    <button 
                      onClick={() => handleLanguagePresetChange('bash')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${compilerLang === 'bash' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Bash Shell
                    </button>
                    <button 
                      onClick={() => handleLanguagePresetChange('cpp')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${compilerLang === 'cpp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      C++ 20
                    </button>
                  </div>

                  <button 
                    onClick={loadWeatherApiKeyPreset}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors flex items-center gap-1.5 shadow-sm"
                    title="Nạp mẫu thử nghiệm Python Weather & đọc API Key từ biến môi trường"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mẫu Weather & API Key</span>
                  </button>
                </div>
              </div>

              {/* Code Editor and Output Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Editor Column */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Mã Nguồn Cần Biên Dịch ({compilerLang}):</span>
                    <span className="text-[11px] text-slate-500 font-normal">Real Linux execution · 8s limit</span>
                  </div>
                  <textarea 
                    value={compilerCode}
                    onChange={e => setCompilerCode(e.target.value)}
                    rows={12}
                    className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-300 rounded-xl border border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed resize-none"
                    placeholder="Nhập mã nguồn..."
                  />

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Standard Input (stdin):</label>
                    <input 
                      type="text"
                      value={compilerStdin}
                      onChange={e => setCompilerStdin(e.target.value)}
                      placeholder="Dữ liệu truyền vào stdin nếu cần..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    />
                  </div>

                  <button 
                    onClick={handleRunCompiler}
                    disabled={isRunningCompiler}
                    className="w-full py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRunningCompiler ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang gửi code lên Remote Sandbox & chạy thật...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Biên Dịch & Thực Thi Thực Tế Trên Remote Compiler</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Output Terminal Console Column */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Console Đầu Ra Thật (stdout / stderr):</span>
                    {compilerOutput && (
                      <span className="text-[11px] text-emerald-600 font-mono">
                        {compilerOutput.executionTimeMs}ms · exit {compilerOutput.exitCode}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 font-mono text-xs min-h-[300px] flex flex-col justify-between overflow-x-auto">
                    <div className="space-y-3">
                      <div className="text-slate-500 text-[11px] border-b border-slate-800 pb-2 flex items-center justify-between">
                        <span>$ sandbox-exec --lang={compilerLang}</span>
                        <span className="text-emerald-400 text-[10px]">
                          {compilerOutput?.engine || 'Piston Real Sandbox'}
                        </span>
                      </div>

                      {compilerOutput ? (
                        <div className="space-y-3">
                          {compilerOutput.stdout && (
                            <div>
                              <span className="text-slate-500 text-[10px] block mb-1">[stdout]</span>
                              <pre className="text-emerald-300 whitespace-pre-wrap">{compilerOutput.stdout}</pre>
                            </div>
                          )}

                          {compilerOutput.stderr && (
                            <div>
                              <span className="text-red-400 text-[10px] block mb-1">[stderr]</span>
                              <pre className="text-red-300 whitespace-pre-wrap">{compilerOutput.stderr}</pre>
                            </div>
                          )}

                          {compilerOutput.analysis && (
                            <div className="pt-2 border-t border-slate-800/80">
                              <span className="text-slate-400 text-[10px] block mb-0.5">Trạng thái thực thi:</span>
                              <p className="text-slate-300 text-[11px] font-sans leading-relaxed">
                                {compilerOutput.analysis}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs py-16 text-center">
                          Nhấn nút để thực thi mã nguồn thực tế và xem kết quả xuất ra màn hình tại đây.
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-600 pt-2 border-t border-slate-900 flex justify-between">
                      <span>Status: {isRunningCompiler ? "Executing in container..." : "Ready"}</span>
                      <span>Real Linux Sandbox</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution History from Firestore */}
              <div className="border-t border-slate-200 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-600" />
                    <span>Lịch Sử Chạy Code Từ Xa (Lưu Trực Tiếp Trên Firestore)</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">{executionHistory.length} bản ghi gần nhất</span>
                </div>

                {executionHistory.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {executionHistory.map(item => (
                      <div key={item.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 uppercase font-mono">{item.language}</span>
                          <span className="text-slate-500 font-mono">{item.executionTimeMs}ms · exit {item.exitCode}</span>
                        </div>
                        <pre className="bg-slate-900 text-emerald-300 p-2 rounded text-[10px] font-mono overflow-x-auto max-h-20">
                          {item.stdout || item.stderr || "(Không có output)"}
                        </pre>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span>{item.engine}</span>
                          <span>{new Date(item.createdAt).toLocaleTimeString('vi-VN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                    Chưa có lịch sử thực thi nào. Khi bạn bấm "Biên Dịch & Thực Thi", kết quả sẽ tự động lưu vào Firestore.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REMOTE SERVERS (SSE / CLOUD MANAGER & PING) */}
        {activeTab === 'remote-servers' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Quản Lý & Kiểm Tra Máy Chủ MCP Từ Xa (Remote Server Inspector)</h2>
              <p className="text-slate-600 text-sm mt-1">Kết nối, kiểm tra đường truyền SSE, và lưu trữ danh sách các máy chủ MCP đang chạy từ xa của bạn.</p>
            </div>

            {/* Health Dashboard Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
                    <span>Real-Time Health Dashboard (Trạng Thái Sức Khỏe MCP Servers)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tự động ping kiểm tra định kỳ mỗi 30 giây để đảm bảo các máy chủ từ xa hoạt động ổn định.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                    Tổng: <strong className="text-slate-900">{serverList.length}</strong> | 
                    Online: <strong className="text-emerald-600">{Object.values(healthStatuses).filter(s => s.status === 'online').length}</strong> | 
                    Offline: <strong className="text-red-600">{Object.values(healthStatuses).filter(s => s.status === 'offline').length}</strong>
                  </span>
                  <button 
                    onClick={checkAllServersHealth}
                    disabled={isCheckingAllHealth}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAllHealth ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Ping All Now</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {serverList.map(srv => {
                  const health = healthStatuses[srv.id] || { status: 'checking' };
                  return (
                    <div key={srv.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            health.status === 'online' ? 'bg-emerald-500 animate-pulse' :
                            health.status === 'offline' ? 'bg-red-500' : 'bg-amber-400 animate-ping'
                          }`}></span>
                          <h4 className="font-bold text-sm text-slate-900 truncate max-w-[160px]">{srv.name}</h4>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          health.status === 'online' ? 'bg-emerald-100 text-emerald-800' :
                          health.status === 'offline' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {health.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                        <div className="truncate text-slate-500">URL: {srv.url}</div>
                        <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200">
                          <span>Độ trễ: {health.latencyMs !== undefined ? `${health.latencyMs}ms` : '---'}</span>
                          <span>Kiểm tra: {health.lastChecked || 'Đang quét'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Add & Ping Form */}
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Thêm & Kiểm Tra Máy Chủ MCP Mới</span>
                </h3>

                <form onSubmit={handleAddRemoteServer} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Tên Máy Chủ</label>
                    <input 
                      type="text" 
                      value={newServerName} 
                      onChange={e => setNewServerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">URL Máy Chủ (SSE / HTTP Endpoint)</label>
                    <input 
                      type="url" 
                      value={newServerUrl} 
                      onChange={e => setNewServerUrl(e.target.value)}
                      placeholder="https://your-server.com/sse"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Bearer Token Bảo Mật (Tùy chọn)</label>
                    <input 
                      type="text" 
                      value={newServerToken} 
                      onChange={e => setNewServerToken(e.target.value)}
                      placeholder="secret-token-key"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => handlePingServer(newServerUrl, newServerToken)}
                      disabled={isPinging}
                      className="py-2.5 font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isPinging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>Ping Kết Nối</span>
                    </button>

                    <button 
                      type="submit"
                      className="py-2.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lưu Vào DB</span>
                    </button>
                  </div>
                </form>

                {/* Ping Result Display */}
                {pingResult && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2 ${pingResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>{pingResult.success ? "Kết nối thành công!" : "Lỗi kết nối"}</span>
                      {pingResult.latencyMs && <span className="font-mono">{pingResult.latencyMs}ms</span>}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {pingResult.message || pingResult.error}
                    </p>
                  </div>
                )}
              </div>

              {/* Server List Display */}
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-bold text-sm text-slate-900">Danh Sách Máy Chủ MCP Từ Xa (Cloud Firestore)</h3>
                  <span className="text-xs text-slate-500 font-mono">{serverList.length} máy chủ</span>
                </div>

                <div className="space-y-3">
                  {serverList.map(server => (
                    <div key={server.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h4 className="font-bold text-sm text-slate-900">{server.name}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handlePingServer(server.url, server.authToken)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1"
                          >
                            <Radio className="w-3 h-3 text-indigo-600" />
                            <span>Ping</span>
                          </button>
                          {server.id !== 'sample-1' && (
                            <button 
                              onClick={() => handleDeleteServer(server.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900 text-emerald-300 p-2.5 rounded-lg font-mono text-[11px] break-all">
                        {server.url}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                        <span>Transport: <strong className="text-slate-700 uppercase">{server.transport}</strong></span>
                        <span>Trạng thái: <strong className="text-emerald-600">{server.status}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: VECTOR DATABASE & GOOGLE DRIVE */}
        {activeTab === 'vector-db' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Vector Database & Google Drive Integration</h2>
                <p className="text-slate-600 text-sm mt-1">Phân tích tích hợp cơ sở dữ liệu Vector (ChromaDB / Pinecone) với Python và Google Drive để xây dựng bộ não RAG cho AI.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">1</div>
                <h3 className="font-bold text-slate-900 text-base">Google Drive Sync</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tự động đồng bộ tài liệu, PDF, Google Docs từ Google Drive làm nguồn dữ liệu thô (Unstructured Data) cho hệ thống RAG.
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">2</div>
                <h3 className="font-bold text-slate-900 text-base">Gemini Embeddings</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sử dụng model <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">text-embedding-004</code> chuyển đổi văn bản thành vector 768 chiều.
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">3</div>
                <h3 className="font-bold text-slate-900 text-base">Vector Store</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lưu trữ vector và thực hiện truy vấn khoảng cách Cosine Similarity cực nhanh khi AI Agent cần tra cứu tri thức.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>Cấu trúc Dữ liệu Vector (Schema)</span>
                  </h3>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">JSON / Dict</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mỗi bản ghi vector trong cơ sở dữ liệu bao gồm định danh, mảng float embeddings và metadata từ Google Drive:
                </p>
                <div className="bg-slate-950 text-emerald-300 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                  <pre>{`{
  "id": "doc_drive_9921",
  "embedding": [
    0.0142, -0.0521, 0.1894, 
    -0.0031, 0.0812, "..." // 768 floats
  ],
  "document": "Báo cáo chiến lược AI & Database 2026",
  "metadata": {
    "source": "Google Drive",
    "file_id": "1XyZ..._drive",
    "mimeType": "application/pdf"
  }
}`}</pre>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-500" />
                    <span>Mã mẫu Python: Google Drive + ChromaDB + Gemini</span>
                  </h3>
                  <button 
                    onClick={() => copyToClipboard(`# Python Vector DB & Google Drive RAG Integration
from google import genai
import chromadb

client = genai.Client()
db_client = chromadb.PersistentClient(path="./vector_store")
collection = db_client.get_or_create_collection(name="drive_knowledge")

def sync_drive_file(file_id: str, title: str, content: str):
    res = client.models.embed_content(
        model="text-embedding-004",
        contents=content
    )
    vector = res.embeddings[0].values
    collection.upsert(
        ids=[file_id],
        embeddings=[vector],
        documents=[content],
        metadatas=[{"title": title}]
    )
    print(f"Synced {title} to Vector DB")
`)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>
                </div>
                <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[380px]">
                  <pre>{`# Python Vector DB & Google Drive RAG Integration
from google import genai
import chromadb

# Khởi tạo Gemini Client & ChromaDB
client = genai.Client()
db_client = chromadb.PersistentClient(path="./vector_store")
collection = db_client.get_or_create_collection(name="drive_knowledge")

def sync_drive_file(file_id: str, title: str, content: str):
    """Đồng bộ tệp Google Drive vào Vector Database"""
    # Tạo embedding với Google GenAI SDK
    res = client.models.embed_content(
        model="text-embedding-004",
        contents=content
    )
    vector = res.embeddings[0].values
    
    # Lưu vào ChromaDB
    collection.upsert(
        ids=[file_id],
        embeddings=[vector],
        documents=[content],
        metadatas=[{"title": title, "source": "Google Drive"}]
    )
    print(f"✅ Đã đồng bộ thành công: {title}")

def query_rag_brain(query: str):
    """Truy vấn RAG tìm kiếm ngữ nghĩa"""
    q_res = client.models.embed_content(
        model="text-embedding-004",
        contents=query
    )
    results = collection.query(
        query_embeddings=[q_res.embeddings[0].values],
        n_results=3
    )
    return results`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ROADMAP & PREREQUISITES */}
        {activeTab === 'roadmap' && (
          <div className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Lộ Trình Xây Dựng Máy Chủ MCP & Tool Cho AI</h2>
              <p className="text-slate-600 text-sm mt-1">Các bước và kiến thức kỹ thuật cần thiết từ chuẩn bị môi trường đến triển khai lên Cloud.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  01
                </div>
                <h3 className="text-base font-semibold text-slate-900">Nền Tảng Lập Trình</h3>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>TypeScript / Node.js</strong> (Khuyên dùng SDK chính thức `@modelcontextprotocol/sdk`).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Python 3.10+</strong> (Hỗ trợ gói thư viện `mcp` chính thức từ Anthropic).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Kiến thức cơ bản về bất đồng bộ (Async/Await) và API.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  02
                </div>
                <h3 className="text-base font-semibold text-slate-900">Hiểu Biết Về Giao Thức</h3>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>JSON-RPC 2.0</strong>: Giao thức thông điệp trao đổi giữa AI Client và MCP Server.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Transport Layer</strong>: Stdio (giao tiếp qua tiêu chuẩn nhập/xuất dòng lệnh) hoặc SSE (Server-Sent Events qua HTTP).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>JSON Schema</strong>: Định nghĩa cấu trúc tham số đầu vào cho Tool.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  03
                </div>
                <h3 className="text-base font-semibold text-slate-900">Môi Trường Test & Dùng Thật</h3>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Claude Desktop App</strong>: Ứng dụng desktop hỗ trợ cấu hình `mcpServers`.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>MCP Inspector</strong>: Công cụ web CLI (`npx @modelcontextprotocol/inspector`) để debug request/response.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>IDE như Cursor hoặc VS Code để phát triển code server.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ARCHITECTURE & PROTOCOL */}
        {activeTab === 'architecture' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kiến Trúc & Luồng Hoạt Động Giao Thức MCP</h2>
              <p className="text-slate-600 text-sm mt-1">Sơ đồ tương tác giữa AI Client, Transport Layer và Custom MCP Server của bạn.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="bg-slate-900 text-white p-6 rounded-xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Client Host</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">AI Application</span>
                  </div>
                  <h4 className="font-bold text-base">Claude Desktop / Cursor</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Gửi yêu cầu của người dùng, phân tích và quyết định khi nào cần gọi MCP Tool hoặc đọc Resource.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
                  <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-full text-slate-700 border border-slate-200">
                    JSON-RPC 2.0 (stdio / SSE)
                  </span>
                  <div className="w-full h-0.5 bg-slate-300 relative flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                  </div>
                  <span className="text-[11px] text-slate-500">Truyền thông điệp an toàn</span>
                </div>

                <div className="bg-emerald-950 text-white p-6 rounded-xl space-y-3 shadow-md border border-emerald-800">
                  <div className="flex items-center justify-between text-emerald-300 text-xs">
                    <span>MCP Server</span>
                    <span className="bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded">Custom Tool</span>
                  </div>
                  <h4 className="font-bold text-base">Máy Chủ MCP Của Bạn</h4>
                  <p className="text-xs text-emerald-200 leading-relaxed">
                    Chạy trên máy local (Node.js/Python), xử lý logic thực thi code, truy vấn database hoặc gọi REST API.
                  </p>
                </div>
              </div>

              {/* DEDICATED API KEY SECURITY ARCHITECTURE */}
              <div className="border-t border-slate-200 pt-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Lock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Kiến Trúc Bảo Mật API Key Cho MCP Server (Không Bao Giờ Lộ Cho AI)</h3>
                    <p className="text-xs text-slate-500">Cách các ứng dụng như Claude Desktop, Cursor, Cline bảo vệ bí mật khi gọi API bên thứ ba (Thời tiết, Database, AI).</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bước 1</div>
                    <h4 className="text-xs font-bold text-slate-900">Khai Báo Trong Config</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Điền API Key vào trường <code>"env"</code> trong file <code>claude_desktop_config.json</code> trên máy của bạn.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bước 2</div>
                    <h4 className="text-xs font-bold text-slate-900">Host Inject Tiến Trình</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Claude Desktop spawn tiến trình Python (hoặc Node) và truyền biến môi trường an toàn vào bộ nhớ HĐH.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bước 3</div>
                    <h4 className="text-xs font-bold text-slate-900">Server Đọc Qua os.getenv</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mã Python dùng <code>os.getenv("WEATHER_API_KEY")</code> nạp key vào Header HTTP gửi đến nhà cung cấp API.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Bước 4</div>
                    <h4 className="text-xs font-bold text-emerald-950">AI Chỉ Thấy Kết Quả Sạch</h4>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Chỉ có kết quả dự báo thời tiết được gửi về LLM. Chuỗi API Key 100% được giấu kín khỏi prompt!
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <strong>Cấu hình mẫu cho Claude Desktop (macOS / Windows):</strong>
                    <div className="font-mono text-[11px] text-amber-900 mt-1">
                      &#123; "mcpServers": &#123; "weather": &#123; "command": "python", "args": ["weather.py"], "env": &#123; "WEATHER_API_KEY": "your_key" &#125; &#125; &#125; &#125;
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTemplate(templates.find(t => t.id === 'nws-weather') || templates[0]);
                      setActiveTab('templates');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 shadow-sm"
                  >
                    Xem Code Mẫu Weather NWS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GENERATOR */}
        {activeTab === 'generator' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trình Tạo Mã Nguồn MCP Server Tự Động</h2>
              <p className="text-slate-600 text-sm mt-1">Định nghĩa công cụ của bạn bên dưới và để AI sinh ra mã nguồn chuẩn chỉnh bằng TypeScript hoặc Python.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Input */}
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <form onSubmit={handleGenerateCode} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Ngôn Ngữ Lập Trình</label>
                    <select 
                      value={language} 
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      <option value="typescript">TypeScript (@modelcontextprotocol/sdk)</option>
                      <option value="python">Python (mcp package)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Tên Tool (Snake Case)</label>
                    <input 
                      type="text" 
                      value={toolName} 
                      onChange={e => setToolName(e.target.value)}
                      placeholder="vd: search_jira_issues"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Mô Tả Tool Cho AI</label>
                    <textarea 
                      value={toolDesc} 
                      onChange={e => setToolDesc(e.target.value)}
                      rows={3}
                      placeholder="Mô tả chi tiết tool dùng để làm gì..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 outline-none"
                      required
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tham Số Đầu Vào (Argument Schema)</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">Tên Tham Số</label>
                        <input 
                          type="text" 
                          value={argName} 
                          onChange={e => setArgName(e.target.value)} 
                          className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">Kiểu Dữ Liệu</label>
                        <select 
                          value={argType} 
                          onChange={e => setArgType(e.target.value)} 
                          className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white outline-none"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* API Key Security Configuration Block */}
                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Bảo Mật API Key</span>
                          <span className="text-[10px] text-slate-500">Tích hợp qua biến môi trường (.env)</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={requiresApiKey} 
                          onChange={e => setRequiresApiKey(e.target.checked)} 
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {requiresApiKey && (
                      <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-amber-900 flex items-center justify-between">
                            <span>Tên Biến Môi Trường (Env Name):</span>
                            <span className="text-[10px] text-amber-700 font-mono font-normal">os.getenv("{apiKeyEnvName}")</span>
                          </label>
                          <input 
                            type="text" 
                            value={apiKeyEnvName} 
                            onChange={e => setApiKeyEnvName(e.target.value.toUpperCase())} 
                            placeholder="vd: WEATHER_API_KEY, OPENAI_API_KEY..."
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-amber-300 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div className="text-[11px] text-amber-900/90 leading-relaxed space-y-1">
                          <p>
                            🔒 <strong>Nguyên Tắc Vàng Của MCP:</strong> Tuyệt đối không hardcode API Key trong code hoặc gõ vào prompt của AI.
                          </p>
                          <p className="text-[10px] text-amber-800">
                            Claude Desktop / Cursor sẽ truyền an toàn qua cấu hình <code>"env"</code> trong file json khi khởi chạy server.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={isGenerating}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Đang tạo mã nguồn MCP bằng AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Tạo Mã Nguồn MCP Server {requiresApiKey ? '(Kèm API Key)' : ''}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Code Output Display */}
              <div className="lg:col-span-7 space-y-6">
                {generatedResult ? (
                  <div className="space-y-6">
                    {/* Source Code */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">1. Mã Nguồn MCP Server Hoàn Chỉnh</h3>
                          <p className="text-xs text-slate-500">Đã tích hợp đọc API Key và xử lý lỗi.</p>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(generatedResult.code)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1.5"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? "Đã sao chép!" : "Sao chép code"}</span>
                        </button>
                      </div>

                      <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80">
                        <pre>{generatedResult.code}</pre>
                      </div>
                    </div>

                    {/* Claude Desktop Config JSON with ENV */}
                    {generatedResult.configJson && (
                      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-500" />
                              <span>2. Cấu Hình claude_desktop_config.json</span>
                            </h3>
                            <p className="text-xs text-slate-500">Nơi điền API Key bí mật của bạn vào mục "env".</p>
                          </div>
                          <button 
                            onClick={() => {
                              copyToClipboard(generatedResult.configJson);
                              setCopiedConfig(true);
                              setTimeout(() => setCopiedConfig(false), 2000);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedConfig ? "Đã sao chép!" : "Sao chép config"}</span>
                          </button>
                        </div>

                        <div className="bg-slate-950 text-amber-300 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-56">
                          <pre>{generatedResult.configJson}</pre>
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <p className="font-semibold text-slate-700">📍 Đường dẫn file cấu hình Claude Desktop:</p>
                          <p>• <strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
                          <p>• <strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></p>
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    {generatedResult.instructions && (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Hướng Dẫn Cài Đặt</h4>
                        <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {generatedResult.instructions}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">Chưa có mã nguồn được tạo</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Nhập tên tool (ví dụ: <code>get_weather_forecast</code>), bật mục <strong>Bảo Mật API Key</strong> và nhấn nút tạo code.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kho Mẫu MCP Sẵn Sàng Triển Khai</h2>
                <p className="text-slate-600 text-sm mt-1">Các mẫu chuẩn cho Weather API (kèm API Key), Remote Compiler, Remote SSE Cloud, File System và PostgreSQL.</p>
              </div>
              <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 shadow-xs">
                Tổng cộng: <strong className="text-slate-900">{templates.length}</strong> mẫu chuẩn
              </div>
            </div>

            {/* Thanh Tìm Kiếm & Lọc Ngôn Ngữ Phía Trên Danh Sách Mẫu */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={templateSearchQuery}
                  onChange={e => setTemplateSearchQuery(e.target.value)}
                  placeholder="Tìm template nhanh theo tên hoặc mục đích sử dụng (vd: weather, api key, database, sse, code runner)..."
                  className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all placeholder:text-slate-400"
                />
                {templateSearchQuery && (
                  <button 
                    onClick={() => setTemplateSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Bộ lọc nhanh theo Ngôn ngữ */}
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  <span>Ngôn ngữ:</span>
                </span>
                <button 
                  onClick={() => setTemplateLanguageFilter('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${templateLanguageFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Tất cả ({templates.length})
                </button>
                <button 
                  onClick={() => setTemplateLanguageFilter('python')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${templateLanguageFilter === 'python' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Python ({templates.filter(t => t.language.toLowerCase() === 'python').length})
                </button>
                <button 
                  onClick={() => setTemplateLanguageFilter('typescript')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${templateLanguageFilter === 'typescript' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                  TypeScript ({templates.filter(t => t.language.toLowerCase() === 'typescript').length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Template List */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 pb-1">
                  <span>Tìm thấy: <strong className="text-slate-900">{filteredTemplates.length}</strong> template</span>
                  {(templateSearchQuery || templateLanguageFilter !== 'all') && (
                    <button 
                      onClick={() => {
                        setTemplateSearchQuery('');
                        setTemplateLanguageFilter('all');
                      }}
                      className="text-emerald-600 hover:underline text-[11px] font-semibold"
                    >
                      Bỏ lọc
                    </button>
                  )}
                </div>

                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map(tmpl => (
                    <div 
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTemplate?.id === tmpl.id ? 'bg-slate-900 text-white border-slate-950 shadow-md ring-1 ring-emerald-400/50' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h4 className="font-semibold text-sm line-clamp-1">{tmpl.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${selectedTemplate?.id === tmpl.id ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-600'}`}>
                          {tmpl.language}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${selectedTemplate?.id === tmpl.id ? 'text-slate-300' : 'text-slate-600'}`}>
                        {tmpl.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-900">Không tìm thấy template nào</h5>
                      <p className="text-[11px] text-slate-500">
                        Không có kết quả khớp với từ khóa "{templateSearchQuery}".
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setTemplateSearchQuery('');
                        setTemplateLanguageFilter('all');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                    >
                      Xóa bộ lọc tìm kiếm
                    </button>
                  </div>
                )}
              </div>

              {/* Template Detail */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                {selectedTemplate ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h3>
                        <p className="text-xs text-slate-600 mt-1"><strong>Ứng dụng:</strong> {selectedTemplate.useCase}</p>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(selectedTemplate.code)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? "Đã sao chép!" : "Sao chép code"}</span>
                      </button>
                    </div>

                    <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[450px]">
                      <pre>{selectedTemplate.code}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">Vui lòng chọn một mẫu template bên trái.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 text-center text-xs text-slate-500 space-y-2 mt-auto">
        <p>© 2026 MCP Forge & Real Remote Compiler Studio. Tích hợp Cloud Firestore & Piston Engine Sandbox.</p>
        <p className="text-slate-400">Hỗ trợ đầy đủ Claude Desktop, Cursor, Cline và Agentic AI qua giao thức Model Context Protocol chuẩn.</p>
      </footer>
    </div>
  );
}
