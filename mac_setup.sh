#!/bin/bash

# ================================================================
# Micboard Mac Setup Script - Production Ready
# ================================================================
# This script will set up Micboard from scratch on macOS
# It installs all dependencies and configures for production use
# ================================================================

set -euo pipefail  # Exit on any error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/setup.log"
VENV_NAME="myenv"
SERVICE_NAME="com.micboard.server"
PLIST_FILE="${HOME}/Library/LaunchAgents/${SERVICE_NAME}.plist"

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Function to print colored output and log
print_status() {
    local message="$1"
    echo -e "${BLUE}[INFO]${NC} $message"
    log_message "INFO" "$message"
}

print_success() {
    local message="$1"
    echo -e "${GREEN}[SUCCESS]${NC} $message"
    log_message "SUCCESS" "$message"
}

print_warning() {
    local message="$1"
    echo -e "${YELLOW}[WARNING]${NC} $message"
    log_message "WARNING" "$message"
}

print_error() {
    local message="$1"
    echo -e "${RED}[ERROR]${NC} $message"
    log_message "ERROR" "$message"
}

print_production() {
    local message="$1"
    echo -e "${CYAN}[PRODUCTION]${NC} $message"
    log_message "PRODUCTION" "$message"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        print_error "Setup failed with exit code $exit_code"
        print_error "Check the log file: $LOG_FILE"
    fi
    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT

# Function to check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check macOS version
    local macos_version=$(sw_vers -productVersion)
    local major_version=$(echo "$macos_version" | cut -d. -f1)
    local minor_version=$(echo "$macos_version" | cut -d. -f2)
    
    if [ "$major_version" -lt 10 ] || ([ "$major_version" -eq 10 ] && [ "$minor_version" -lt 15 ]); then
        print_error "macOS 10.15 (Catalina) or later is required. Current version: $macos_version"
        exit 1
    fi
    
    print_success "macOS version $macos_version is supported"
    
    # Check available disk space (need at least 2GB)
    local available_space=$(df -g . | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 2 ]; then
        print_warning "Low disk space: ${available_space}GB available. At least 2GB recommended."
    else
        print_success "Disk space check passed: ${available_space}GB available"
    fi
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root is not recommended for security reasons"
    fi
}

# Function to check if running on macOS
check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_error "This script is designed for macOS only."
        exit 1
    fi
}

# Function to install Homebrew
install_homebrew() {
    if command_exists brew; then
        print_success "Homebrew is already installed"
        return
    fi
    
    print_status "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    print_success "Homebrew installed successfully"
}

# Function to install Node.js
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 20 ]]; then
            print_success "Node.js v$NODE_VERSION is already installed (meets requirement >=20)"
            return
        else
            print_warning "Node.js v$NODE_VERSION is installed but version 20+ is required"
        fi
    fi
    
    print_status "Installing Node.js 20+ via Homebrew..."
    brew install node@20
    
    # Link node@20 to make it the default
    brew link --force node@20
    
    print_success "Node.js installed successfully"
}

# Function to install Python
install_python() {
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        
        if [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -ge 12 ]]; then
            print_success "Python $PYTHON_VERSION is already installed (meets requirement >=3.12)"
            return
        else
            print_warning "Python $PYTHON_VERSION is installed but version 3.12+ is required"
        fi
    fi
    
    print_status "Installing Python 3.12+ via Homebrew..."
    brew install python@3.12
    
    # Create symlinks to make python3 point to the Homebrew version
    brew link --force python@3.12
    
    print_success "Python installed successfully"
}

# Function to install additional dependencies
install_dependencies() {
    print_status "Installing additional dependencies via Homebrew..."
    
    # Install git if not present (usually comes with Xcode Command Line Tools)
    if ! command_exists git; then
        print_status "Installing git..."
        brew install git
    fi
    
    # Install other useful tools
    brew install curl wget
    
    print_success "Dependencies installed successfully"
}

# Function to setup Python virtual environment
setup_python_env() {
    print_status "Setting up Python virtual environment..."
    
    # Remove existing virtual environment if it exists
    if [ -d "myenv" ]; then
        print_status "Removing existing virtual environment..."
        rm -rf myenv
    fi
    
    # Create new virtual environment
    python3 -m venv myenv
    
    # Activate virtual environment
    source myenv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install Python dependencies
    print_status "Installing Python dependencies..."
    pip install -r py/requirements.txt
    
    print_success "Python virtual environment setup complete"
}

# Function to setup Node.js dependencies
setup_nodejs_env() {
    print_status "Setting up Node.js dependencies..."
    
    # Install Node.js dependencies
    npm install
    
    # Build frontend assets
    print_status "Building frontend assets..."
    npm run build
    
    print_success "Node.js environment setup complete"
}

# Function to create OAuth setup template
create_oauth_template() {
    print_status "Creating OAuth setup template..."
    
    cat > oauth_setup_template.sh << 'EOF'
#!/bin/bash
# ================================================================
# OAuth Configuration for Micboard Integrations
# ================================================================
# Edit the values below with your actual OAuth credentials
# Then source this file before starting the server
# Usage: source oauth_setup_template.sh
# ================================================================

# Planning Center OAuth
# Get these from: https://api.planningcenteronline.com/oauth/applications
export PCO_CLIENT_ID="your_pco_client_id_here"
export PCO_CLIENT_SECRET="your_pco_client_secret_here"
export PCO_REDIRECT_URI="http://localhost:8058/api/pco/callback"

# Google Drive OAuth
# Get these from: https://console.cloud.google.com/
export GOOGLE_CLIENT_ID="your_google_client_id_here"
export GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
export GOOGLE_REDIRECT_URI="http://localhost:8058/api/drive/callback"

# Optional: Override default port
# export MICBOARD_PORT=8058

echo "OAuth environment variables set!"
echo ""
echo "Now run: ./run_server.sh"
echo ""
EOF
    
    chmod +x oauth_setup_template.sh
    print_success "OAuth setup template created: oauth_setup_template.sh"
}

# Function to create startup script
create_startup_script() {
    print_status "Creating startup script..."
    
    cat > start_micboard.sh << 'EOF'
#!/bin/bash
# ================================================================
# Micboard Startup Script - Production Ready
# ================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_NAME="myenv"
LOG_FILE="${SCRIPT_DIR}/micboard.log"
PID_FILE="${SCRIPT_DIR}/micboard.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log_message "INFO" "$1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log_message "SUCCESS" "$1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log_message "WARNING" "$1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log_message "ERROR" "$1"
}

# Check if already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Micboard is already running (PID: $pid)"
            echo "To stop: kill $pid or run ./stop_micboard.sh"
            exit 1
        else
            print_status "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi
}

# Start server
start_server() {
    print_status "Starting Micboard server..."
    
    # Check if virtual environment exists
    if [ ! -d "$VENV_NAME" ]; then
        print_error "Virtual environment not found. Please run mac_setup.sh first."
        exit 1
    fi
    
    # Activate virtual environment
    source "$VENV_NAME/bin/activate"
    
    # Check if OAuth credentials are set
    if [[ -z "${PCO_CLIENT_ID:-}" && -z "${GOOGLE_CLIENT_ID:-}" ]]; then
        print_warning "No OAuth credentials detected. To use integrations:"
        echo "1. Edit oauth_setup_template.sh with your credentials"
        echo "2. Run: source oauth_setup_template.sh"
        echo "3. Then run this script again"
        echo ""
        print_status "Starting without integrations..."
    fi
    
    # Start Micboard in background
    print_status "Starting Micboard on http://localhost:8058"
    nohup python py/micboard.py > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    
    # Wait a moment to check if it started successfully
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        print_success "Micboard started successfully (PID: $pid)"
        print_status "Logs: tail -f $LOG_FILE"
        print_status "Stop: ./stop_micboard.sh"
    else
        print_error "Failed to start Micboard. Check logs: $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Main execution
main() {
    check_running
    start_server
}

main "$@"
EOF
    
    chmod +x start_micboard.sh
    print_success "Startup script created: start_micboard.sh"
}

# Function to create stop script
create_stop_script() {
    print_status "Creating stop script..."
    
    cat > stop_micboard.sh << 'EOF'
#!/bin/bash
# ================================================================
# Micboard Stop Script
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/micboard.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stop server
stop_server() {
    if [ ! -f "$PID_FILE" ]; then
        print_warning "No PID file found. Micboard may not be running."
        exit 0
    fi
    
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        print_status "Stopping Micboard (PID: $pid)..."
        kill "$pid"
        
        # Wait for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Graceful shutdown failed, forcing kill..."
            kill -9 "$pid"
        fi
        
        print_success "Micboard stopped successfully"
    else
        print_warning "Process $pid is not running"
    fi
    
    rm -f "$PID_FILE"
}

stop_server
EOF
    
    chmod +x stop_micboard.sh
    print_success "Stop script created: stop_micboard.sh"
}

# Function to create system service (LaunchAgent)
create_system_service() {
    print_production "Creating system service for automatic startup..."
    
    # Create LaunchAgents directory if it doesn't exist
    mkdir -p "${HOME}/Library/LaunchAgents"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/start_micboard.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/micboard.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/micboard.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF
    
    print_success "System service created: $PLIST_FILE"
    print_production "To enable auto-start: launchctl load $PLIST_FILE"
    print_production "To disable auto-start: launchctl unload $PLIST_FILE"
}

# Function to create production configuration
create_production_config() {
    print_production "Creating production configuration..."
    
    cat > production.env << 'EOF'
# ================================================================
# Micboard Production Environment Configuration
# ================================================================
# Copy this file to .env and customize for your production setup
# ================================================================

# Server Configuration
MICBOARD_PORT=8058
MICBOARD_HOST=0.0.0.0
MICBOARD_DEBUG=false

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=micboard.log
LOG_MAX_SIZE=10MB
LOG_BACKUP_COUNT=5

# Security Configuration
SECRET_KEY=your-secret-key-here-change-this-in-production
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true

# OAuth Configuration (set these in oauth_setup_template.sh instead)
# PCO_CLIENT_ID=your_pco_client_id
# PCO_CLIENT_SECRET=your_pco_client_secret
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret

# Performance Configuration
WORKER_PROCESSES=1
MAX_CONNECTIONS=100
KEEPALIVE_TIMEOUT=5

# Monitoring Configuration
HEALTH_CHECK_INTERVAL=30
STATUS_ENDPOINT=/api/health
METRICS_ENDPOINT=/api/metrics
EOF
    
    print_success "Production configuration template created: production.env"
}

# Function to create monitoring script
create_monitoring_script() {
    print_production "Creating monitoring script..."
    
    cat > monitor_micboard.sh << 'EOF'
#!/bin/bash
# ================================================================
# Micboard Monitoring Script
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SCRIPT_DIR}/micboard.pid"
LOG_FILE="${SCRIPT_DIR}/micboard.log"
HEALTH_URL="http://localhost:8058/api/health"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[MONITOR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[MONITOR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[MONITOR]${NC} $1"
}

print_error() {
    echo -e "${RED}[MONITOR]${NC} $1"
}

# Check if process is running
check_process() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Check health endpoint
check_health() {
    if curl -s -f "$HEALTH_URL" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Get status
get_status() {
    if check_process; then
        local pid=$(cat "$PID_FILE")
        if check_health; then
            print_success "Micboard is running (PID: $pid) and healthy"
            return 0
        else
            print_warning "Micboard is running (PID: $pid) but not responding to health checks"
            return 1
        fi
    else
        print_error "Micboard is not running"
        return 1
    fi
}

# Show logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        print_status "Recent logs:"
        tail -n 20 "$LOG_FILE"
    else
        print_warning "No log file found"
    fi
}

# Main monitoring
main() {
    case "${1:-status}" in
        "status")
            get_status
            ;;
        "logs")
            show_logs
            ;;
        "health")
            if check_health; then
                print_success "Health check passed"
            else
                print_error "Health check failed"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 {status|logs|health}"
            exit 1
            ;;
    esac
}

main "$@"
EOF
    
    chmod +x monitor_micboard.sh
    print_success "Monitoring script created: monitor_micboard.sh"
}

# Function to verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js: $NODE_VERSION"
    else
        print_error "Node.js not found"
        return 1
    fi
    
    # Check Python
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python: $PYTHON_VERSION"
    else
        print_error "Python not found"
        return 1
    fi
    
    # Check if virtual environment exists
    if [ -d "myenv" ]; then
        print_success "Python virtual environment: myenv/"
    else
        print_error "Python virtual environment not found"
        return 1
    fi
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        print_success "Node.js dependencies: node_modules/"
    else
        print_error "Node.js dependencies not found"
        return 1
    fi
    
    # Check if static files are built
    if [ -d "static" ] && [ "$(ls -A static)" ]; then
        print_success "Frontend assets: static/"
    else
        print_warning "Frontend assets not built - run 'npm run build' if needed"
    fi
    
    print_success "Installation verification complete!"
}

# Function to display next steps
show_next_steps() {
    echo ""
    echo "================================================================"
    echo "🎉 Micboard Production Setup Complete!"
    echo "================================================================"
    echo ""
    echo "📋 Generated Scripts:"
    echo "   • start_micboard.sh    - Start the server"
    echo "   • stop_micboard.sh     - Stop the server"
    echo "   • monitor_micboard.sh  - Monitor server status"
    echo "   • oauth_setup_template.sh - OAuth configuration"
    echo ""
    echo "🚀 Quick Start:"
    echo "   1. Start Micboard:"
    echo "      ./start_micboard.sh"
    echo ""
    echo "   2. Open in browser:"
    echo "      http://localhost:8058"
    echo ""
    echo "   3. Monitor status:"
    echo "      ./monitor_micboard.sh status"
    echo ""
    echo "🔧 Production Setup:"
    echo "   1. Enable auto-start on boot:"
    echo "      launchctl load $PLIST_FILE"
    echo ""
    echo "   2. Configure OAuth integrations:"
    echo "      - Edit oauth_setup_template.sh with your credentials"
    echo "      - Run: source oauth_setup_template.sh"
    echo "      - Restart: ./stop_micboard.sh && ./start_micboard.sh"
    echo ""
    echo "   3. Customize production settings:"
    echo "      - Copy production.env to .env and customize"
    echo "      - Review security settings and change secret keys"
    echo ""
    echo "📊 Monitoring & Management:"
    echo "   • Check status:     ./monitor_micboard.sh status"
    echo "   • View logs:        ./monitor_micboard.sh logs"
    echo "   • Health check:     ./monitor_micboard.sh health"
    echo "   • Stop server:      ./stop_micboard.sh"
    echo ""
    echo "📁 Important Files:"
    echo "   • Setup log:        $LOG_FILE"
    echo "   • Server log:       micboard.log"
    echo "   • PID file:         micboard.pid"
    echo "   • Service config:   $PLIST_FILE"
    echo ""
    echo "🛠️  Development:"
    echo "   • Frontend changes: npm run build"
    echo "   • Python changes:   ./stop_micboard.sh && ./start_micboard.sh"
    echo ""
    echo "================================================================"
    print_production "Setup completed successfully! Check $LOG_FILE for detailed logs."
}

# Main execution
main() {
    echo "================================================================"
    echo "🚀 Micboard Mac Setup Script"
    echo "================================================================"
    echo ""
    
    # Check if running on macOS
    check_macos
    
    # Check system requirements
    check_system_requirements
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "py/requirements.txt" ]; then
        print_error "Please run this script from the Micboard project root directory"
        exit 1
    fi
    
    print_status "Starting Micboard production setup from scratch..."
    echo ""
    
    # Install dependencies
    install_homebrew
    install_nodejs
    install_python
    install_dependencies
    
    echo ""
    print_status "Setting up project environment..."
    
    # Setup project
    setup_python_env
    setup_nodejs_env
    
    echo ""
    print_status "Creating helper scripts..."
    
    # Create helper scripts
    create_oauth_template
    create_startup_script
    create_stop_script
    create_monitoring_script
    
    echo ""
    print_production "Setting up production features..."
    
    # Create production features
    create_system_service
    create_production_config
    
    echo ""
    # Verify installation
    verify_installation
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
