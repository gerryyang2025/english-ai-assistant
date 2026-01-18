#!/bin/bash

# Word Wizard - Server Script
# Uses Flask-based server with API proxy for AI features
# Usage: ./run.sh start|stop|restart|install [production]

PORT=8082
export PORT
PID_FILE=".server.pid"

# Check if using virtual environment
USE_VENV=false

# Create virtual environment if it doesn't exist
create_venv() {
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        
        # Try python3 -m venv first
        if python3 -m venv venv 2>/dev/null; then
            echo "Virtual environment created!"
            USE_VENV=true
            return 0
        fi
        
        # Try using virtualenv package
        echo "Trying alternative method..."
        if command -v virtualenv &> /dev/null; then
            if virtualenv venv 2>/dev/null; then
                echo "Virtual environment created with virtualenv!"
                USE_VENV=true
                return 0
            fi
        fi
        
        # Fall back to system packages without venv
        echo "Warning: Virtual environment not available, using system packages."
        echo "Note: This may require sudo or affect system packages."
        USE_VENV=false
    else
        USE_VENV=true
    fi
}

# Get pip command (handles both venv and system pip)
get_pip_cmd() {
    if [ "$USE_VENV" = true ] && [ -f "venv/bin/pip" ]; then
        echo "venv/bin/pip"
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

install_deps() {
    echo "Installing dependencies..."
    echo ""
    
    # Create virtual environment first
    create_venv
    
    # Get appropriate pip command
    PIP_CMD=$(get_pip_cmd)
    
    if [ -z "$PIP_CMD" ]; then
        echo "[Error] pip not found!"
        echo ""
        echo "On Ubuntu/Debian, install with:"
        echo "  sudo apt-get install python3-pip"
        exit 1
    fi
    
    echo "[Debug] Using pip: $PIP_CMD"
    echo ""
    echo "Installing packages: gunicorn flask requests"
    echo "----------------------------------------"
    
    if $PIP_CMD install gunicorn flask requests; then
        echo "----------------------------------------"
        echo "[OK] Dependencies installed successfully!"
        echo ""
    else
        echo "----------------------------------------"
        echo ""
        echo "[Error] Failed to install packages!"
        echo ""
        echo "Possible solutions:"
        echo "  1. Try with sudo:"
        echo "     sudo $PIP_CMD install gunicorn flask requests"
        echo ""
        echo "  2. On Ubuntu/Debian, install system packages:"
        echo "     sudo apt-get update"
        echo "     sudo apt-get install -y python3-flask python3-requests"
        echo ""
        exit 1
    fi
}

start_server() {
    local mode=${1:-dev}
    
    echo "========================================"
    echo "Starting Server (Debug Mode)"
    echo "========================================"
    echo "Port: $PORT"
    echo "Mode: $mode"
    echo "Python: $(get_python_cmd)"
    echo "Virtual Environment: $USE_VENV"
    echo "PID File: $PID_FILE"
    echo ""
    
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "Warning: Server may already be running (PID: $OLD_PID)"
            echo "Use './run.sh stop' first, or './run.sh restart'"
            return 1
        else
            echo "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi

    echo "Starting server on port $PORT (mode: $mode)..."
    echo ""

    # Get Python command
    PYTHON_CMD=$(get_python_cmd)
    echo "[Debug] Using Python: $PYTHON_CMD"
    
    # Check if Flask is available
    echo "[Debug] Checking Flask availability..."
    if ! $PYTHON_CMD -c "import flask" 2>&1; then
        echo ""
        echo "[Warning] Flask not found!"
        echo ""
        echo "Please run './run.sh install' first to install dependencies."
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

    # Start server based on mode
    if [ "$mode" = "production" ]; then
        # Production mode with Gunicorn
        echo "[Debug] Checking Gunicorn..."
        if ! command -v gunicorn &> /dev/null; then
            echo "[Info] Installing Gunicorn for production..."
            PIP_CMD=$(get_pip_cmd)
            if ! $PIP_CMD install gunicorn 2>&1; then
                echo "[Error] Failed to install Gunicorn!"
                exit 1
            fi
        fi
        
        # Start Gunicorn with multiple workers
        echo "[Info] Starting Gunicorn production server..."
        echo "[Debug] Command: gunicorn server:app -w 4 -b 0.0.0.0:$PORT"
        
        if [ "$USE_VENV" = true ]; then
            venv/bin/gunicorn server:app -w 4 -b 0.0.0.0:$PORT --pid $PID_FILE --daemon 2>&1
        else
            gunicorn server:app -w 4 -b 0.0.0.0:$PORT --pid $PID_FILE --daemon 2>&1
        fi
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -ne 0 ]; then
            echo "[Error] Gunicorn failed to start (exit code: $EXIT_CODE)"
            echo "Check logs with: cat nohup.out 2>/dev/null || journalctl -u gunicorn 2>/dev/null"
        else
            echo "[OK] Server started with Gunicorn"
        fi
    else
        # Development mode - capture output for debugging
        echo "[Debug] Starting development server..."
        echo "[Debug] Command: $PYTHON_CMD server.py"
        
        LOG_FILE="server.log"
        if [ "$USE_VENV" = true ]; then
            venv/bin/python server.py > "$LOG_FILE" 2>&1 &
        else
            python3 server.py > "$LOG_FILE" 2>&1 &
        fi
        SERVER_PID=$!
        
        echo "[Debug] Server PID: $SERVER_PID"
        echo "$SERVER_PID" > "$PID_FILE"
        
        # Wait a moment and check if process is still running
        sleep 1
        
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo "[OK] Server started successfully (PID: $SERVER_PID)"
        else
            echo "[Error] Server failed to start!"
            echo ""
            echo "=== Server Output ==="
            if [ -f "$LOG_FILE" ]; then
                cat "$LOG_FILE"
            else
                echo "(No log file found)"
            fi
            echo "====================="
            echo ""
            rm -f "$PID_FILE"
            exit 1
        fi
    fi

    echo ""
    echo "======================================"
    echo "Access URL: http://localhost:$PORT"
    echo "======================================"
    echo ""
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
            echo "[Info] Stale PID file found (process not running)"
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
        echo "[Info] Server is not running"
    fi
    echo ""
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
    echo "Access URL: http://localhost:$PORT"
    echo ""
    
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
        if [ "$2" = "prod" ] || [ "$2" = "production" ]; then
            start_server production
        else
            start_server dev
        fi
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        if [ "$2" = "prod" ] || [ "$2" = "production" ]; then
            start_server production
        else
            start_server dev
        fi
        ;;
    install)
        install_deps
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: ./run.sh {start|stop|restart|install|status} [prod]"
        echo ""
        echo "Commands:"
        echo "  ./run.sh start        # Development mode (Flask built-in)"
        echo "  ./run.sh start prod   # Production mode (Gunicorn)"
        echo "  ./run.sh stop         # Stop server"
        echo "  ./run.sh restart      # Restart"
        echo "  ./run.sh install      # Install dependencies"
        echo "  ./run.sh status       # Check server status"
        echo ""
        echo "Configuration:"
        echo "  cp api_config.example.py api_config.py"
        echo "  # Edit api_config.py and add your MiniMax API Key"
        echo ""
        exit 1
        ;;
esac
