#!/bin/bash
echo "Starting Micboard server..."

# Activate virtual environment if it exists
if [ -d "myenv" ]; then
    echo "Activating virtual environment..."
    source myenv/bin/activate
else
    echo "Virtual environment not found. Creating one..."
    python3 -m venv myenv
    source myenv/bin/activate
    echo "Installing dependencies..."
    pip install -r py/requirements.txt
fi

# Set environment variables for OAuth (you should set these with your actual values)
# export PCO_CLIENT_ID="your_pco_client_id"
# export PCO_CLIENT_SECRET="your_pco_client_secret"
# export GOOGLE_CLIENT_ID="your_google_client_id"
# export GOOGLE_CLIENT_SECRET="your_google_client_secret"

echo "Starting Micboard..."
python py/micboard.py
