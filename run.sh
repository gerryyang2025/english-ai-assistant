#!/bin/bash

# Word Wizard - Server Script
# Uses Flask-based server with API proxy for AI features
# Usage: ./server.sh start|stop|restart|install [production]

PORT=8082
export PORT
PID_FILE=".server.pid"

# Create virtual environment if it doesn't exist
create_venv() {
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
        echo "Virtual environment created!"
    fi
}

# Activate virtual environment
activate_venv() {
    source venv/bin/activate
}

install_deps() {
    echo "Installing dependencies..."
    create_venv
    activate_venv
    pip install gunicorn flask requests
    echo "Dependencies installed!"
}

start_server() {
    local mode=${1:-dev}
    
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "Server is already running (PID: $OLD_PID)"
            return 1
        else
            rm "$PID_FILE"
        fi
    fi

    echo "Starting server on port $PORT (mode: $mode)..."

    # Create virtual environment if needed
    create_venv
    activate_venv

    # Check dependencies
    if ! python -c "import flask" 2>/dev/null; then
        echo "Installing Flask and dependencies..."
        pip install flask requests
    fi

    # Check if api_config.py exists
    if [ ! -f "api_config.py" ]; then
        echo ""
        echo "Configuration file not found!"
        echo "Please copy: cp api_config.example.py api_config.py"
        echo ""
    fi

    # Start server based on mode
    if [ "$mode" = "production" ]; then
        # Production mode with Gunicorn
        if ! command -v gunicorn &> /dev/null; then
            echo "Installing Gunicorn for production..."
            pip install gunicorn
        fi
        
        # Start Gunicorn with multiple workers
        echo "Starting Gunicorn production server..."
        gunicorn server:app -w 4 -b 0.0.0.0:$PORT --pid $PID_FILE --daemon
        echo "Server started with Gunicorn"
    else
        # Development mode
        python server.py > /dev/null 2>&1 &
        SERVER_PID=$!
        echo "$SERVER_PID" > "$PID_FILE"
    fi

    echo ""
    echo "======================================"
    echo "Access URL: http://localhost:$PORT"
    echo "======================================"
    echo ""
    echo "Mode: $mode"
    echo ""
    echo "Commands:"
    echo "  ./server.sh start        # Development mode"
    echo "  ./server.sh start prod   # Production mode (Gunicorn)"
    echo "  ./server.sh stop         # Stop server"
    echo ""
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm "$PID_FILE"
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
        echo "Usage: ./server.sh {start|stop|restart|install} [prod]"
        echo ""
        echo "Commands:"
        echo "  ./server.sh start        # Development mode (Flask built-in)"
        echo "  ./server.sh start prod   # Production mode (Gunicorn)"
        echo "  ./server.sh stop         # Stop server"
        echo "  ./server.sh restart      # Restart"
        echo "  ./server.sh install      # Install dependencies"
        echo ""
        echo "Configuration:"
        echo "  cp api_config.example.py api_config.py"
        echo "  # Edit api_config.py and add your MiniMax API Key"
        echo ""
        exit 1
        ;;
esac
