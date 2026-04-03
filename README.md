# DeepSec M3 (DeepSec AI Runtime + MCP Bridge)

DeepSec M3 - bu Flask asosidagi security control plane, Ollama AI runtime integratsiyasi, MCP bridge va web paneldan iborat orchestratsiya platformasi.

Muhim: ushbu loyiha faqat authorized (ruxsat berilgan) security test, audit va lab muhitlarida ishlatilishi kerak.

## Nimalar bor

- Flask API server (`deepsec_engine.py`) - 150+ security yo'nalish endpointlari.
- MCP client/bridge (`deepsec_bridge.py`) - FastMCP orqali AI agentlarga tool functionlarni ochadi.
- AI runtime adapter (`deepsec_ai_runtime.py`) - Ollama bilan yagona gateway.
- Web panel (`templates/panel.html`, `static/js/panel.js`, `static/css/panel.css`) - operator UI.
- MCP config (`deepsec-core-mcp.json`) - MCP clientga ulash uchun tayyor konfiguratsiya.

## Arxitektura

1. `deepsec_engine.py` ishga tushadi va `:8888` da API beradi.
2. Web panel `/` route orqali shu serverdan servis qilinadi.
3. AI endpointlar Ollama serveriga (`DEEPSEC_OLLAMA_URL`) so'rov yuboradi.
4. `deepsec_bridge.py` engine API bilan gaplashib, MCP tool sifatida eksponatsiya qiladi.

Qisqa oqim:

`Operator/Web Panel -> DeepSec Engine (Flask API) -> Local tools / Ollama`

`AI Agent (MCP) -> deepsec_bridge.py -> DeepSec Engine API`

## Asosiy komponentlar

- `deepsec_engine.py`
  - Web panel home: `GET /`
  - Health: `GET /health`
  - AI health/chat: `GET /api/ai/health`, `POST /api/ai/chat`
  - AI payloadlar: `POST /api/ai/generate_payload`, `POST /api/ai/test_payload`
  - Smart intelligence: analyze/select/optimize/attack-chain/smart-scan
  - Bug bounty workflow endpointlari
  - Juda ko'p `api/tools/*` endpointlari (nmap, nuclei, ffuf, sqlmap, va boshqalar)

- `deepsec_bridge.py`
  - MCP server nomi: `deepsec-core-mcp`
  - `--server`, `--timeout`, `--debug` argumentlari
  - Engine API endpointlari bilan mapping qilingan ko'plab MCP tool funksiyalari

- `deepsec_ai_runtime.py`
  - Ollama `health`, `generate_text`, `generate_json`
  - Strict JSON parse fallbacklari

## Tez boshlash (Auto Installer)

Loyiha bilan birga `auto_install.sh` skripti berilgan.

### 1) Skriptga execute huquq berish

```bash
chmod +x auto_install.sh
```

### 2) Standard install (Python env + requirements)

```bash
./auto_install.sh
```

### 3) Core security paketlar bilan

```bash
./auto_install.sh --with-tools
```

### 4) Ollama install/pull bilan

```bash
./auto_install.sh --install-ollama --ollama-model minimax-m2.5:cloud
```

Skript nima qiladi:

- APT asosidagi tizimlarda (Kali/Ubuntu/Debian) bazaviy paketlarni o'rnatadi.
- Virtual environment yaratadi (`deepsec_env`).
- `requirements.txt` ni o'rnatadi.
- Ixtiyoriy ravishda core security tool paketlarni o'rnatadi.
- Ixtiyoriy ravishda Ollama o'rnatib model pull qilishga urinadi.

## Manual o'rnatish

## Linux (Kali/Ubuntu/Debian)

### 1) System paketlar

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip python3-dev build-essential libffi-dev libssl-dev git curl jq
```

Ixtiyoriy core tool paketlar:

```bash
sudo apt-get install -y nmap gobuster dirb nikto sqlmap hydra john hashcat ffuf masscan dnsenum amass
```

### 2) Python environment

```bash
python3 -m venv deepsec_env
source deepsec_env/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
```

### 3) Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

Yangi terminalda:

```bash
ollama pull minimax-m2.5:cloud
```

## Windows (PowerShell)

### 1) Python env

```powershell
py -3 -m venv deepsec_env
.\deepsec_env\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
```

### 2) Ollama

- Ollama Windows installer bilan o'rnating.
- Model pull qiling:

```powershell
ollama pull minimax-m2.5:cloud
```

## Ishga tushirish

## 1) Engine (Control Plane)

Development:

```bash
python3 deepsec_engine.py --debug --port 8888
```

Production (Waitress):

```bash
python3 deepsec_engine.py --production --threads 8 --port 8888
```

Server odatda:

- Web panel: `http://127.0.0.1:8888/`
- Health: `http://127.0.0.1:8888/health`

## 2) MCP Bridge

```bash
python3 deepsec_bridge.py --server http://127.0.0.1:8888 --timeout 300
```

Debug mode:

```bash
python3 deepsec_bridge.py --server http://127.0.0.1:8888 --debug
```

## 3) MCP config ishlatish

`deepsec-core-mcp.json` ichida bridge komandasi berilgan. Zarur bo'lsa `python3` ni tizimingizga mos path bilan almashtiring (`python` yoki to'liq executable path).

## Muhit o'zgaruvchilari (Environment Variables)

- `DEEPSEC_PORT` (default: `8888`)
- `DEEPSEC_HOST` (default: `127.0.0.1`)
- `DEEPSEC_OLLAMA_URL` (default: `http://127.0.0.1:11434`)
- `DEEPSEC_OLLAMA_MODEL` (default: `minimax-m2.5:cloud`)
- `DEEPSEC_OLLAMA_TIMEOUT` (default: `180`)
- `DEEPSEC_AI_ENFORCE_OLLAMA` (default: `true`)

Linux/macOS misol:

```bash
export DEEPSEC_OLLAMA_URL="http://127.0.0.1:11434"
export DEEPSEC_OLLAMA_MODEL="minimax-m2.5:cloud"
export DEEPSEC_AI_ENFORCE_OLLAMA="true"
python3 deepsec_engine.py --production
```

Windows PowerShell misol:

```powershell
$env:DEEPSEC_OLLAMA_URL = "http://127.0.0.1:11434"
$env:DEEPSEC_OLLAMA_MODEL = "minimax-m2.5:cloud"
$env:DEEPSEC_AI_ENFORCE_OLLAMA = "true"
python deepsec_engine.py --production
```

## API bo'limlari (qisqa overview)

## Core

- `GET /health`
- `POST /api/command`
- `GET /api/telemetry`
- `GET /api/cache/stats`
- `POST /api/cache/clear`

## AI

- `GET /api/ai/health`
- `POST /api/ai/chat`
- `POST /api/ai/generate_payload`
- `POST /api/ai/test_payload`

## Intelligence

- `POST /api/intelligence/analyze-target`
- `POST /api/intelligence/select-tools`
- `POST /api/intelligence/optimize-parameters`
- `POST /api/intelligence/create-attack-chain`
- `POST /api/intelligence/smart-scan`
- `POST /api/intelligence/technology-detection`

## Bug bounty workflow

- `POST /api/bugbounty/reconnaissance-workflow`
- `POST /api/bugbounty/vulnerability-hunting-workflow`
- `POST /api/bugbounty/business-logic-workflow`
- `POST /api/bugbounty/osint-workflow`
- `POST /api/bugbounty/file-upload-testing`
- `POST /api/bugbounty/comprehensive-assessment`

## Process management

- `GET /api/processes/list`
- `GET /api/processes/status/<int:pid>`
- `POST /api/processes/terminate/<int:pid>`
- `POST /api/processes/pause/<int:pid>`
- `POST /api/processes/resume/<int:pid>`
- `GET /api/processes/dashboard`

## Tool endpointlardan namunalar

- `POST /api/tools/nmap`
- `POST /api/tools/gobuster`
- `POST /api/tools/nuclei`
- `POST /api/tools/nikto`
- `POST /api/tools/sqlmap`
- `POST /api/tools/ffuf`
- `POST /api/tools/wpscan`
- `POST /api/tools/rustscan`
- `POST /api/tools/masscan`
- `POST /api/tools/burpsuite-alternative`
- `POST /api/tools/api_fuzzer`
- `POST /api/tools/graphql_scanner`
- `POST /api/tools/jwt_analyzer`

Eslatma: barcha tool endpointlar o'rnatilgan tashqi binarylarga bog'liq.

## Tezkor API misollar

### Health

```bash
curl -s http://127.0.0.1:8888/health | jq
```

### AI Chat

```bash
curl -s -X POST http://127.0.0.1:8888/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Target bolimida dastlabki recon uchun checklist ber"}' | jq
```

### Target Analyze

```bash
curl -s -X POST http://127.0.0.1:8888/api/intelligence/analyze-target \
  -H "Content-Type: application/json" \
  -d '{"target":"https://example.com"}' | jq
```

### Smart Scan

```bash
curl -s -X POST http://127.0.0.1:8888/api/intelligence/smart-scan \
  -H "Content-Type: application/json" \
  -d '{"target":"https://example.com","objective":"quick","max_tools":3}' | jq
```

### AI Payload Generation

```bash
curl -s -X POST http://127.0.0.1:8888/api/ai/generate_payload \
  -H "Content-Type: application/json" \
  -d '{"attack_type":"xss","complexity":"advanced","technology":"php"}' | jq
```

## Web panel

Server ishga tushgach browserda oching:

- `http://127.0.0.1:8888/`

Panelda quyidagilar bor:

- AI Command Console
- Target Intelligence
- Smart Scan
- Payload Lab
- Real-time status cardlar (Control Plane / Ollama)

## MCP integratsiya tezkor yo'riqnomasi

1. Engine serverni ishga tushiring.
2. Bridge ni ishga tushiring.
3. MCP clientda `deepsec-core-mcp.json` dagi configni qo'shing.
4. MCP tool calllar orqali scan/intelligence functionlardan foydalaning.

## Loyiha tuzilmasi

```text
deepsec_engine.py         # Flask control plane + endpointlar
deepsec_bridge.py         # MCP bridge client
deepsec_ai_runtime.py     # Ollama runtime adapter
deepsec-core-mcp.json     # MCP server config
requirements.txt          # Python dependencies
auto_install.sh           # Auto installer (bash)
templates/panel.html      # Web panel HTML
static/js/panel.js        # Web panel JS
static/css/panel.css      # Web panel CSS
```

## Troubleshooting

- `api/ai/*` 503 qaytsa:
  - Ollama ishlayotganini tekshiring: `curl http://127.0.0.1:11434/api/tags`
  - Model mavjudligini tekshiring: `ollama list`
  - `DEEPSEC_OLLAMA_MODEL` ni moslang.

- `api/tools/*` xatolar:
  - `/health` dagi `tools_status` ni tekshiring.
  - Yetishmayotgan binarylarni tizimga o'rnating.

- MCP bridge ulanmasa:
  - `deepsec_bridge.py --server http://127.0.0.1:8888 --debug` bilan log ko'ring.
  - API server avval ishga tushgan bo'lishi kerak.

## Security va legal

- Faqat qonuniy, ruxsat berilgan test muhitlarida ishlating.
- Production tizimlarda oldin staging/lab validatsiya qiling.
- Ushbu platformadan noqonuniy foydalanish qat'iyan man etiladi.

## Developer notes

- `requirements.txt` Python kutubxonalarni o'rnatadi, lekin ko'p security CLI vositalar alohida o'rnatiladi.
- `deepsec_engine.py` juda katta endpoint to'plamiga ega; deploymentdan oldin kerakli tool stackni minimal prinsipda tanlash tavsiya etiladi.
