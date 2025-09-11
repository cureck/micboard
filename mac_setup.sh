#!/bin/bash

# ================================================================
# Micboard Mac Setup Script
# ================================================================
# This script will set up Micboard from scratch on macOS
# It installs all dependencies and starts the server
# ================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
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
# Micboard Startup Script
# ================================================================

echo "Starting Micboard server..."

# Check if virtual environment exists
if [ ! -d "myenv" ]; then
    echo "Error: Virtual environment not found. Please run mac_setup.sh first."
    exit 1
fi

# Activate virtual environment
source myenv/bin/activate

# Check if OAuth credentials are set
if [[ -z "$PCO_CLIENT_ID" && -z "$GOOGLE_CLIENT_ID" ]]; then
    echo ""
    echo "No OAuth credentials detected. To use integrations:"
    echo "1. Edit oauth_setup_template.sh with your credentials"
    echo "2. Run: source oauth_setup_template.sh"
    echo "3. Then run this script again"
    echo ""
    echo "Starting without integrations..."
    echo ""
fi

# Start Micboard
echo "Starting Micboard on http://localhost:8058"
python py/micboard.py
EOF
    
    chmod +x start_micboard.sh
    print_success "Startup script created: start_micboard.sh"
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
    echo "🎉 Micboard Setup Complete!"
    echo "================================================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start Micboard:"
    echo "   ./start_micboard.sh"
    echo ""
    echo "2. Open in browser:"
    echo "   http://localhost:8058"
    echo ""
    echo "3. Optional - Set up integrations:"
    echo "   - Edit oauth_setup_template.sh with your OAuth credentials"
    echo "   - Run: source oauth_setup_template.sh"
    echo "   - Restart: ./start_micboard.sh"
    echo ""
    echo "4. For development:"
    echo "   - Frontend changes: npm run build"
    echo "   - Python changes: restart server"
    echo ""
    echo "================================================================"
}

# Main execution
main() {
    echo "================================================================"
    echo "🚀 Micboard Mac Setup Script"
    echo "================================================================"
    echo ""
    
    # Check if running on macOS
    check_macos
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "py/requirements.txt" ]; then
        print_error "Please run this script from the Micboard project root directory"
        exit 1
    fi
    
    print_status "Starting Micboard setup from scratch..."
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
    
    echo ""
    # Verify installation
    verify_installation
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
