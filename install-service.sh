#!/usr/bin/env bash
# install-service.sh

# --- Configuration ---
SERVICE_NAME="geodaisy"
SERVICE_DESCRIPTION="Geodaisy the webpage"
PROD_SERVER_SCRIPT_NAME="start-prod-server"
# --- End Configuration ---

# --- Pre-flight checks ---
# Must be run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root. Please use 'sudo'."
  exit 1
fi

# Must be run via sudo by a non-root user
if [ -z "$SUDO_USER" ] || [ "$SUDO_USER" == "root" ]; then
    echo "Error: This script should be run by a non-root user using 'sudo'."
    echo "Example: sudo bash $0"
    exit 1
fi
# --- End Pre-flight checks ---

# --- Environment Setup ---
TARGET_USER=$SUDO_USER
APP_DIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Installing service for user: ${TARGET_USER}"
echo "Application directory: ${APP_DIR}"

# --- Find npm for the target user ---
# This is tricky because of nvm/nodenv etc.
# We will try to find it by running a command as the user.
NPM_PATH=$(su - "$TARGET_USER" -c 'which npm')

if [ -z "$NPM_PATH" ]; then
    echo "Error: Could not find 'npm' in the path for user '${TARGET_USER}'."
    echo "Please ensure Node.js and npm are installed and available in the user's PATH."
    echo "You may need to adjust the user's .bashrc or .profile."
    exit 1
fi
echo "Found npm at: ${NPM_PATH}"
# --- End Find npm ---

# --- Create systemd service file ---
echo "Creating systemd service file at ${SERVICE_FILE}..."

# Using a heredoc to create the service file content
cat > "$SERVICE_FILE" << EOL
[Unit]
Description=${SERVICE_DESCRIPTION}
After=network.target

[Service]
Type=simple
User=${TARGET_USER}
Group=$(id -gn "$TARGET_USER")
WorkingDirectory=${APP_DIR}

# Set environment variables for the service
Environment="NODE_ENV=production"
Environment="PORT=3000"

ExecStart=${NPM_PATH} run ${PROD_SERVER_SCRIPT_NAME}

Restart=on-failure
RestartSec=10

# Standard output and error logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOL
# --- End Create systemd service file ---

# --- Install and start the service ---
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling service '${SERVICE_NAME}' to start on boot..."
systemctl enable "$SERVICE_NAME.service"

echo "Starting service '${SERVICE_NAME}'..."
systemctl start "$SERVICE_NAME.service"
# --- End Install and start the service ---

# --- Final Instructions ---
echo ""
echo "---------------------------------------------------------"
echo "Service '${SERVICE_NAME}' installed and started."
echo ""
echo "IMPORTANT:"
echo "1. Ensure you have run 'npm install' to install dependencies."
echo "2. Ensure you have run 'npm run build' to create the production build."
echo ""
echo "You can check the service status with:"
echo "   sudo systemctl status ${SERVICE_NAME}"
echo ""
echo "You can view the logs with:"
echo "   sudo journalctl -u ${SERVICE_NAME} -f"
echo "---------------------------------------------------------"

exit 0
