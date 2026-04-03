#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${PROJECT_DIR}/deepsec_env"

WITH_TOOLS=0
INSTALL_OLLAMA=0
OLLAMA_MODEL="${DEEPSEC_OLLAMA_MODEL:-minimax-m2.5:cloud}"

log() {
  printf '[INFO] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

err() {
  printf '[ERROR] %s\n' "$1" >&2
}

usage() {
  cat <<'EOF'
DeepSec M3 Auto Installer

Usage:
  ./auto_install.sh [options]

Options:
  --with-tools                    Install core external security tool packages (APT-based systems)
  --install-ollama                Install Ollama if missing and pull model
  --ollama-model <model>          Ollama model to pull (default: minimax-m2.5:cloud)
  -h, --help                      Show this help message

Examples:
  ./auto_install.sh
  ./auto_install.sh --with-tools
  ./auto_install.sh --install-ollama --ollama-model minimax-m2.5:cloud
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Required command not found: $cmd"
    exit 1
  fi
}

apt_install_if_available() {
  local pkg="$1"
  if apt-cache show "$pkg" >/dev/null 2>&1; then
    log "Installing package: $pkg"
    ${SUDO_CMD} apt-get install -y "$pkg"
  else
    warn "Package not available in repository: $pkg"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-tools)
      WITH_TOOLS=1
      shift
      ;;
    --install-ollama)
      INSTALL_OLLAMA=1
      shift
      ;;
    --ollama-model)
      if [[ -z "${2:-}" ]]; then
        err "--ollama-model requires a value"
        exit 1
      fi
      OLLAMA_MODEL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

log "Project directory: ${PROJECT_DIR}"

require_command python3
require_command curl

SUDO_CMD=""
if [[ ${EUID} -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  fi
fi

if command -v apt-get >/dev/null 2>&1; then
  log "Detected APT-based system. Installing base dependencies."
  ${SUDO_CMD} apt-get update -y

  BASE_PACKAGES=(
    python3
    python3-venv
    python3-pip
    python3-dev
    build-essential
    libffi-dev
    libssl-dev
    git
    curl
    jq
  )

  for pkg in "${BASE_PACKAGES[@]}"; do
    apt_install_if_available "$pkg"
  done

  if [[ ${WITH_TOOLS} -eq 1 ]]; then
    log "Installing optional core security tools."
    TOOL_PACKAGES=(
      nmap
      gobuster
      dirb
      nikto
      sqlmap
      hydra
      john
      hashcat
      ffuf
      masscan
      dnsenum
      amass
    )

    for pkg in "${TOOL_PACKAGES[@]}"; do
      apt_install_if_available "$pkg"
    done
  else
    log "Skipping optional security tools installation (use --with-tools to enable)."
  fi
else
  warn "apt-get not found. Skipping OS package install."
fi

log "Creating/updating Python virtual environment at: ${VENV_DIR}"
if [[ ! -d "${VENV_DIR}" ]]; then
  python3 -m venv "${VENV_DIR}"
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

log "Upgrading pip/setuptools/wheel"
python -m pip install --upgrade pip setuptools wheel

log "Installing Python requirements"
python -m pip install -r "${PROJECT_DIR}/requirements.txt"

if [[ ${INSTALL_OLLAMA} -eq 1 ]]; then
  if ! command -v ollama >/dev/null 2>&1; then
    log "Installing Ollama"
    curl -fsSL https://ollama.com/install.sh | sh
  else
    log "Ollama already installed"
  fi

  if command -v ollama >/dev/null 2>&1; then
    if ! pgrep -f "ollama serve" >/dev/null 2>&1; then
      log "Starting Ollama in background"
      nohup ollama serve >/tmp/ollama.log 2>&1 &
      sleep 3
    fi

    log "Pulling Ollama model: ${OLLAMA_MODEL}"
    if ! ollama pull "${OLLAMA_MODEL}"; then
      warn "Model pull failed: ${OLLAMA_MODEL}. Check model name and network connectivity."
    fi
  else
    warn "Ollama installation did not complete successfully."
  fi
fi

cat <<EOF

DeepSec M3 installation completed.

Next steps:
1) Activate environment:
   source "${VENV_DIR}/bin/activate"

2) Start engine:
   python3 "${PROJECT_DIR}/deepsec_engine.py" --production --threads 8 --port 8888

3) (Optional) Start MCP bridge:
   python3 "${PROJECT_DIR}/deepsec_bridge.py" --server http://127.0.0.1:8888 --timeout 300

4) Open web panel:
   http://127.0.0.1:8888/

EOF
