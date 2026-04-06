#!/bin/bash

# Word Wizard - Server Script
# Uses Flask-based server with API proxy for AI features
# Usage: ./optools.sh start|stop|restart|status
#        ./optools.sh init|install [--force]   # venv + Python deps
#        ./optools.sh check-env                # report env & dependencies (no changes)
#        ./optools.sh check-words|check-readings|check-listen [path]
#        ./optools.sh convert-words|convert-readings|convert-listens

# 脚本所在目录即仓库根目录，便于从任意 cwd 调用
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

PORT=8082
export PORT
PID_FILE=".server.pid"

# Primary non-loopback IPv4 for LAN access (Gunicorn binds 0.0.0.0)
get_lan_ipv4() {
    local ip=""
    case "$(uname -s)" in
        Darwin)
            for iface in en0 en1 en2; do
                ip=$(ipconfig getifaddr "$iface" 2>/dev/null)
                case "$ip" in
                    127.*|"") ;;
                    *) echo "$ip"; return 0 ;;
                esac
            done
            ;;
    esac
    if command -v ip >/dev/null 2>&1; then
        ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')
        case "$ip" in
            127.*|"") ;;
            *) echo "$ip"; return 0 ;;
        esac
    fi
    if command -v hostname >/dev/null 2>&1; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        case "$ip" in
            127.*|"") ;;
            *) echo "$ip"; return 0 ;;
        esac
    fi
    return 1
}

print_access_urls() {
    echo "Listen: 0.0.0.0:$PORT (all interfaces)"
    echo ""
    echo "  This computer only:"
    echo "    http://127.0.0.1:$PORT"
    echo "    http://localhost:$PORT"
    echo ""
    local lip
    lip=$(get_lan_ipv4) || true
    if [ -n "$lip" ]; then
        echo "  Same Wi‑Fi / LAN (phone, tablet, another PC) — use this host's IP, not localhost:"
        echo "    http://$lip:$PORT"
        echo ""
    else
        echo "  Same LAN — replace host with this machine's IPv4 (not localhost):"
        echo "    http://<this-host-IPv4>:$PORT"
        echo "    Hint (macOS): ipconfig getifaddr en0"
        echo ""
    fi
    echo "  Public internet (remote access):"
    echo "    Use your router WAN / public IP or DDNS, with port $PORT forwarded to this computer."
    echo "    localhost only works on the machine running the server."
    echo ""
}

# Check if using virtual environment
USE_VENV=false

# Create virtual environment if it doesn't exist
create_venv() {
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        echo ""
        
        # Check Python version first
        echo "[Debug] Python version:"
        python3 --version 2>&1 || echo "python3 not found"
        echo ""
        
        # Try python3 -m venv first
        echo "[Debug] Trying python3 -m venv..."
        if python3 -m venv venv 2>&1; then
            # Verify venv was created correctly
            if [ -f "venv/bin/pip" ] && [ -f "venv/bin/python" ]; then
                echo "Virtual environment created successfully!"
                USE_VENV=true
                return 0
            else
                echo "[Warning] venv directory created but files missing"
            fi
        else
            echo "[Warning] python3 -m venv failed"
        fi
        
        # Try using virtualenv package
        echo ""
        echo "[Debug] Trying virtualenv..."
        if command -v virtualenv &> /dev/null; then
            if virtualenv venv 2>&1; then
                if [ -f "venv/bin/pip" ] && [ -f "venv/bin/python" ]; then
                    echo "Virtual environment created with virtualenv!"
                    USE_VENV=true
                    return 0
                else
                    echo "[Warning] virtualenv created but files missing"
                fi
            fi
        else
            echo "[Debug] virtualenv not installed"
        fi
        
        # Fall back to system packages without venv
        echo ""
        echo "[Warning] Virtual environment not available, using system packages."
        echo "Note: This may require sudo or affect system packages."
        USE_VENV=false
        return 1
    else
        # Verify existing venv is valid
        if [ -f "venv/bin/pip" ] && [ -f "venv/bin/python" ]; then
            echo "Using existing virtual environment"
            USE_VENV=true
            return 0
        else
            echo "[Warning] venv directory exists but is incomplete, recreating..."
            rm -rf venv
            create_venv
            return $?
        fi
    fi
}

# Get pip command (handles both venv and system pip)
get_pip_cmd() {
    if [ "$USE_VENV" = true ] && [ -f "venv/bin/pip" ]; then
        echo "venv/bin/pip"
    elif [ -f "venv/bin/pip3" ]; then
        echo "venv/bin/pip3"
    elif command -v pip3 &> /dev/null; then
        echo "pip3"
    elif command -v pip &> /dev/null; then
        echo "pip"
    else
        echo ""
    fi
}

# Get python command (handles both venv and system python)
get_python_cmd() {
    if [ "$USE_VENV" = true ] && [ -f "venv/bin/python" ]; then
        echo "venv/bin/python"
    else
        echo "python3"
    fi
}

REQUIREMENTS_FILE="requirements.txt"

# Test imports with a given Python executable (no side effects)
python_can_import() {
    local py="$1"
    [ -n "$py" ] && [ -x "$py" ] || return 1
    "$py" -c "import flask, gunicorn, requests" 2>/dev/null
}

# After create_venv / get_python_cmd — true if server deps are importable
python_deps_satisfied() {
    local py
    py=$(get_python_cmd)
    python_can_import "$py"
}

# Read-only: print environment and dependency status (does not create venv)
check_env() {
    echo "Environment check (read-only)"
    echo "============================="
    echo ""
    echo "Repository: $ROOT"
    echo ""

    # --- System tools ---
    echo "[System]"
    if command -v python3 &>/dev/null; then
        echo "  python3: $(python3 --version 2>&1) ($(command -v python3))"
    else
        echo "  python3: NOT FOUND (required)"
    fi
    if command -v node &>/dev/null; then
        echo "  node:    $(node --version 2>&1) ($(command -v node))"
    else
        echo "  node:    NOT FOUND (needed for convert-words / convert-readings / convert-listens)"
    fi
    echo ""

    # --- Virtualenv ---
    echo "[Python virtualenv: ./venv]"
    if [ -d "venv" ] && [ -x "venv/bin/python" ]; then
        echo "  status:  present"
        echo "  python:  $(venv/bin/python --version 2>&1)"
        if python_can_import "venv/bin/python"; then
            echo "  imports: OK (flask, gunicorn, requests)"
        else
            echo "  imports: MISSING — run: ./optools.sh init"
        fi
    else
        echo "  status:  missing or incomplete"
        if command -v python3 &>/dev/null && python_can_import "$(command -v python3)"; then
            echo "  imports: OK on system python3 (no venv — ./optools.sh init recommended for isolation)"
        else
            echo "  imports: n/a"
            echo "  hint:    run ./optools.sh init  (creates venv and installs packages)"
        fi
    fi
    echo ""

    # --- requirements.txt ---
    echo "[Lockfile]"
    if [ -f "$REQUIREMENTS_FILE" ]; then
        echo "  $REQUIREMENTS_FILE: present"
    else
        echo "  $REQUIREMENTS_FILE: MISSING"
    fi
    echo ""

    # --- Config & data (quick) ---
    echo "[Configuration]"
    if [ -f "api_config.py" ]; then
        echo "  api_config.py: present"
    else
        echo "  api_config.py: missing — copy: cp api_config.example.py api_config.py"
    fi
    echo ""
    echo "[Data JSON]"
    for f in data/words.json data/readings.json data/listen.json; do
        if [ -f "$f" ]; then
            echo "  $f: OK"
        else
            echo "  $f: missing"
        fi
    done
    echo ""

    # Exit 0 if python3 exists and packages import (venv preferred, else system python3)
    local ok=false
    if command -v python3 &>/dev/null; then
        if [ -x "venv/bin/python" ] && python_can_import "venv/bin/python"; then
            ok=true
        elif python_can_import "$(command -v python3)"; then
            ok=true
        fi
    fi
    if [ "$ok" = true ]; then
        echo "Summary: Python runtime dependencies are satisfied."
        return 0
    fi
    echo "Summary: Run ./optools.sh init to create venv and install Python packages."
    return 1
}

# Create venv (if needed) and install from requirements.txt; skip if already satisfied unless --force
install_deps() {
    local force=false
    for a in "$@"; do
        [ "$a" = "--force" ] && force=true
    done

    echo "Installing / verifying dependencies..."
    echo ""

    create_venv

    local PIP_CMD
    PIP_CMD=$(get_pip_cmd)
    if [ -z "$PIP_CMD" ]; then
        echo "[Error] pip not found!"
        echo "On Ubuntu/Debian: sudo apt-get install python3-pip"
        exit 1
    fi

    if [ "$force" != true ] && python_deps_satisfied; then
        echo "[OK] Python packages already satisfied (flask, gunicorn, requests)."
        echo "     Use ./optools.sh install --force to reinstall from $REQUIREMENTS_FILE."
        echo ""
        return 0
    fi

    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        echo "[Warning] $REQUIREMENTS_FILE not found; falling back to: pip install gunicorn flask requests"
        echo "----------------------------------------"
        if ! $PIP_CMD install gunicorn flask requests; then
            echo "[Error] pip install failed."
            exit 1
        fi
    else
        echo "Using pip: $PIP_CMD"
        echo "Installing from $REQUIREMENTS_FILE"
        echo "----------------------------------------"
        if ! $PIP_CMD install -r "$REQUIREMENTS_FILE"; then
            echo "[Error] pip install -r $REQUIREMENTS_FILE failed."
            exit 1
        fi
    fi
    echo "----------------------------------------"
    echo "[OK] Python dependencies installed."
    echo ""
}

start_server() {
    # Check if virtual environment exists
    create_venv
    
    echo "========================================"
    echo "Starting Server (Gunicorn)"
    echo "========================================"
    echo "Port: $PORT"
    echo "Python: $(get_python_cmd)"
    echo "Virtual Environment: $USE_VENV"
    echo "PID File: $PID_FILE"
    echo ""
    
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "Warning: Server may already be running (PID: $OLD_PID)"
            echo "Use './optools.sh stop' first, or './optools.sh restart'"
            return 1
        else
            echo "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi

    echo "Starting Gunicorn on port $PORT..."
    echo ""

    # Get Python command
    PYTHON_CMD=$(get_python_cmd)
    echo "[Debug] Using Python: $PYTHON_CMD"
    
    # Check if Flask is available (required by server:app)
    echo "[Debug] Checking Flask availability..."
    if ! $PYTHON_CMD -c "import flask" 2>&1; then
        echo ""
        echo "[Warning] Flask not found!"
        echo ""
        echo "Please run './optools.sh install' first to install dependencies."
        echo ""
        echo "Or install manually with:"
        echo "  pip3 install gunicorn flask requests"
        echo ""
        exit 1
    else
        echo "[OK] Flask is available"
    fi

    # Check if api_config.py exists
    if [ ! -f "api_config.py" ]; then
        echo ""
        echo "[Warning] Configuration file not found!"
        echo "  Please copy: cp api_config.example.py api_config.py"
        echo "  Without API Key, AI assistant will not work."
        echo ""
    fi

    echo "[Debug] Checking Gunicorn..."
    GUNICORN_CMD=""
    if [ "$USE_VENV" = true ] && [ -x "venv/bin/gunicorn" ]; then
        GUNICORN_CMD="venv/bin/gunicorn"
    elif command -v gunicorn &> /dev/null; then
        GUNICORN_CMD="gunicorn"
    else
        echo "[Info] Installing Gunicorn..."
        PIP_CMD=$(get_pip_cmd)
        if ! $PIP_CMD install gunicorn 2>&1; then
            echo "[Error] Failed to install Gunicorn!"
            exit 1
        fi
        if [ "$USE_VENV" = true ] && [ -x "venv/bin/gunicorn" ]; then
            GUNICORN_CMD="venv/bin/gunicorn"
        else
            GUNICORN_CMD="gunicorn"
        fi
    fi

    echo "[Info] Starting Gunicorn..."
    echo "[Debug] Command: $GUNICORN_CMD server:app -w 4 -b 0.0.0.0:$PORT"
    
    $GUNICORN_CMD server:app -w 4 -b 0.0.0.0:$PORT --pid "$PID_FILE" --daemon 2>&1
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "[Error] Gunicorn failed to start (exit code: $EXIT_CODE)"
        echo "Check logs with: cat nohup.out 2>/dev/null || journalctl -u gunicorn 2>/dev/null"
    else
        echo "[OK] Server started with Gunicorn"
    fi

    echo ""
    echo "======================================"
    print_access_urls
    echo "======================================"
}

stop_server() {
    echo "Stopping server..."
    echo ""
    
    local stopped=false
    local found_pid=""
    
    # Check if server is running by PID file first
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Found server process (PID: $PID)"
            kill "$PID"
            sleep 1
            if kill -0 "$PID" 2>/dev/null; then
                echo "Force killing process..."
                kill -9 "$PID" 2>/dev/null
                sleep 1
            fi
            rm -f "$PID_FILE"
            echo "✓ Server stopped (PID: $PID)"
            stopped=true
        else
            echo "[Info] Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi
    
    # Check for any running server processes if not stopped yet
    if [ "$stopped" = false ]; then
        # Check for Python server
        PID=$(pgrep -f "python.*server.py" 2>/dev/null | head -1)
        if [ -n "$PID" ]; then
            echo "Found server process (PID: $PID)"
            kill "$PID" 2>/dev/null
            sleep 1
            if kill -0 "$PID" 2>/dev/null; then
                kill -9 "$PID" 2>/dev/null
            fi
            echo "✓ Server stopped (PID: $PID)"
            stopped=true
        fi
        
        # Check for Gunicorn server
        if [ "$stopped" = false ]; then
            PID=$(pgrep -f "gunicorn.*server:app" 2>/dev/null | head -1)
            if [ -n "$PID" ]; then
                echo "Found Gunicorn process (PID: $PID)"
            pkill -f "gunicorn.*server:app" 2>/dev/null
                sleep 1
                rm -f "$PID_FILE"
                echo "✓ Server stopped (Gunicorn)"
                stopped=true
            fi
        fi
    fi
    
    # Clean up any remaining artifacts
            rm -f "$PID_FILE" 2>/dev/null
    
    echo ""
    if [ "$stopped" = true ]; then
        echo "Done."
    else
        echo "[Info] Server is not running."
        fi
}

# Check server status
check_status() {
    echo "Server Status Check"
    echo "===================="
    echo ""
    
    local running=false
    local pid=""
    
    # Check by PID file first
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✓ Server is running (PID: $PID)"
            running=true
            pid=$PID
        fi
    fi
    
    # If not found by PID file, search by process name
    if [ "$running" = false ]; then
        # Check for Python server
        pid=$(pgrep -f "python.*server.py" 2>/dev/null | head -1)
        if [ -n "$pid" ]; then
            echo "✓ Server is running (PID: $pid)"
            running=true
        fi
        
        # Check for Gunicorn server
        if [ "$running" = false ]; then
            pid=$(pgrep -f "gunicorn.*server:app" 2>/dev/null | head -1)
            if [ -n "$pid" ]; then
                echo "✓ Server is running (Gunicorn, PID: $pid)"
                running=true
            fi
        fi
    fi
    
    if [ "$running" = false ]; then
        echo "✗ Server is not running"
    fi
    
    echo ""
    echo "Port: $PORT"
    print_access_urls
    
    # Check API configuration
    if [ -f "api_config.py" ]; then
        if grep -q "MINIMAX_API_KEY.*=.*'" api_config.py 2>/dev/null; then
            echo "✓ API Key: Configured"
        else
            echo "✗ API Key: Not configured"
        fi
    else
        echo "✗ Config file: Missing (api_config.py)"
    fi
    
    echo ""
}

case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server
        ;;
    install)
        shift
        install_deps "$@"
        ;;
    init)
        shift
        install_deps "$@"
        ;;
    check-env)
        check_env
        ;;
    status)
        check_status
        ;;
    check-words)
        shift
        python3 scripts/check-words-format.py "$@"
        ;;
    check-readings)
        shift
        python3 scripts/check-readings-format.py "$@"
        ;;
    check-listen)
        shift
        python3 scripts/check-listen-format.py "$@"
        ;;
    convert-words)
        shift
        node scripts/convert-words.js "$@"
        ;;
    convert-readings)
        shift
        node scripts/convert-readings.js "$@"
        ;;
    convert-listens)
        shift
        node scripts/convert-listens.js "$@"
        ;;
    *)
        echo "Usage: ./optools.sh <command> [arguments]"
        echo ""
        echo "Server:"
        echo "  ./optools.sh start           # Start (Gunicorn, 4 workers)"
        echo "  ./optools.sh stop            # Stop server"
        echo "  ./optools.sh restart         # Restart"
        echo "  ./optools.sh check-env       # Check python/node/venv/deps (no changes)"
        echo "  ./optools.sh init            # Create venv + pip install (same as install)"
        echo "  ./optools.sh install         # Idempotent install from requirements.txt"
        echo "  ./optools.sh install --force # Reinstall packages"
        echo "  ./optools.sh status          # Server process + API config"
        echo ""
        echo "Data scripts (see scripts/README.md):"
        echo "  ./optools.sh check-words [path/to/WORDS.md]   # default: data/WORDS.md"
        echo "  ./optools.sh check-readings [path/to/READINGS.md]   # default: data/READINGS.md"
        echo "  ./optools.sh check-listen [path/to/LISTEN.md]   # default: data/LISTEN.md"
        echo "  ./optools.sh convert-words"
        echo "  ./optools.sh convert-readings"
        echo "  ./optools.sh convert-listens"
        echo ""
        echo "Configuration:"
        echo "  cp api_config.example.py api_config.py"
        echo "  # Edit api_config.py and add your MiniMax API Key"
        echo ""
        exit 1
        ;;
esac
