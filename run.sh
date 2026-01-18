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
    
    # Create virtual environment first
    create_venv
    
    # Get appropriate pip command
    PIP_CMD=$(get_pip_cmd)
    
    if [ -z "$PIP_CMD" ]; then
        echo "Error: pip not found! Please install pip first."
        echo "On Ubuntu/Debian: sudo apt-get install python3-pip"
        exit 1
    fi
    
    echo "Installing Python packages with $PIP_CMD..."
    if $PIP_CMD install gunicorn flask requests 2>/dev/null; then
        echo "Dependencies installed!"
    else
        echo "Error: Failed to install packages. Try with sudo:"
        echo "  sudo $PIP_CMD install gunicorn flask requests"
        exit 1
    fi
}

start_server() {
    local mode=${1:-dev}
    
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "Server is already running (PID: $OLD_PID)"
            return 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo "Starting server on port $PORT (mode: $mode)..."

    # Ensure dependencies are available
    PYTHON_CMD=$(get_python_cmd)
    
    # Check if Flask is available
    if ! $PYTHON_CMD -c "import flask" 2>/dev/null; then
        echo "Flask not found, installing dependencies..."
        PIP_CMD=$(get_pip_cmd)
        if [ -z "$PIP_CMD" ] || ! $PIP_CMD install flask requests 2>/dev/null; then
            echo "Error: Failed to install Flask. Please run './run.sh install' first."
            exit 1
        fi
    fi

    # Check if api_config.py exists
    if [ ! -f "api_config.py" ]; then
        echo ""
        echo "Warning: Configuration file not found!"
        echo "Please copy: cp api_config.example.py api_config.py"
        echo "Without API Key, AI assistant will not work."
        echo ""
    fi

    # Start server based on mode
    if [ "$mode" = "production" ]; then
        # Production mode with Gunicorn
        if ! command -v gunicorn &> /dev/null; then
            echo "Installing Gunicorn for production..."
            PIP_CMD=$(get_pip_cmd)
            if ! $PIP_CMD install gunicorn 2>/dev/null; then
                echo "Error: Failed to install Gunicorn."
                exit 1
            fi
        fi
        
        # Start Gunicorn with multiple workers
        echo "Starting Gunicorn production server..."
        if [ "$USE_VENV" = true ]; then
            venv/bin/gunicorn server:app -w 4 -b 0.0.0.0:$PORT --pid $PID_FILE --daemon
        else
            gunicorn server:app -w 4 -b 0.0.0.0:$PORT --pid $PID_FILE --daemon
        fi
        echo "Server started with Gunicorn"
    else
        # Development mode
        if [ "$USE_VENV" = true ]; then
            venv/bin/python server.py > /dev/null 2>&1 &
        else
            python3 server.py > /dev/null 2>&1 &
        fi
        SERVER_PID=$!
        echo "$SERVER_PID" > "$PID_FILE"
        echo "Server started (PID: $SERVER_PID)"
    fi

    echo ""
    echo "======================================"
    echo "Access URL: http://localhost:$PORT"
    echo "======================================"
    echo ""
    echo "Mode: $mode"
    echo ""
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm -f "$PID_FILE"
            echo "Server stopped (PID: $PID)"
        else
            # Try Gunicorn cleanup
            pkill -f "gunicorn.*server:app" 2>/dev/null
            rm -f "$PID_FILE" 2>/dev/null
            echo "Server stopped"
        fi
    else
        # Try to stop by process name
        pkill -f "python.*server.py" 2>/dev/null
        pkill -f "gunicorn.*server:app" 2>/dev/null
        rm -f "$PID_FILE" 2>/dev/null
        echo "Server stopped"
    fi
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
    *)
        echo "Usage: ./run.sh {start|stop|restart|install} [prod]"
        echo ""
        echo "Commands:"
        echo "  ./run.sh start        # Development mode (Flask built-in)"
        echo "  ./run.sh start prod   # Production mode (Gunicorn)"
        echo "  ./run.sh stop         # Stop server"
        echo "  ./run.sh restart      # Restart"
        echo "  ./run.sh install      # Install dependencies"
        echo ""
        echo "Configuration:"
        echo "  cp api_config.example.py api_config.py"
        echo "  # Edit api_config.py and add your MiniMax API Key"
        echo ""
        exit 1
        ;;
esac
