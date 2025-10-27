#!/usr/bin/env bash
set -euo pipefail
# install-service.sh

# --- Configuration ---
SERVICE_NAME="geodaisy"
SERVICE_DESCRIPTION="Geodaisy the webpage"
PROD_SERVER_SCRIPT_NAME="start-prod-server"
INSTALL_DIR="/opt/${SERVICE_NAME}"
# --- End Configuration ---

# --- Pre-flight checks ---
# Must be run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root. Please use 'sudo'."
  exit 1
fi

# Prefer running via sudo by a non-root user; allow root for automation
if [ -z "${SUDO_USER:-}" ] || [ "$SUDO_USER" == "root" ]; then
    echo "Warning: No non-root sudo user detected. The service will run as 'root'."
    echo "It's recommended to run: sudo bash $0"
fi
# --- End Pre-flight checks ---

# --- Environment Setup ---
TARGET_USER="${SUDO_USER:-root}"
SOURCE_DIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Installing service for user: ${TARGET_USER}"
echo "Source directory: ${SOURCE_DIR}"
echo "Installation directory: ${INSTALL_DIR}"

# --- Create installation directory and copy files ---
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

echo "Copying application files to ${INSTALL_DIR}..."
# Use rsync to copy all files except development/transient ones.
# The --delete flag ensures that the destination matches the source, removing old files.
rsync -a --delete \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="install-service.sh" \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"

# Check for .env file in source and copy it.
if [ -f "${SOURCE_DIR}/.env" ]; then
    echo "Copying .env file..."
    cp "${SOURCE_DIR}/.env" "${INSTALL_DIR}/.env"
else
    echo "Warning: '.env' file not found in source directory."
    echo "The service will likely fail to start. You may need to create it manually at ${INSTALL_DIR}/.env"
fi

echo "Setting ownership for ${INSTALL_DIR}..."
chown -R "$TARGET_USER:$(id -gn "$TARGET_USER")" "$INSTALL_DIR"
# --- End copy and file operations ---

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

# --- Install dependencies and build in the new location ---
echo "Installing production dependencies in ${INSTALL_DIR}..."
# Run npm install as the target user to respect their environment and permissions
if ! su - "$TARGET_USER" -c "cd \"$INSTALL_DIR\" && $NPM_PATH ci --omit=dev"; then
    echo "Error: 'npm ci' failed. Please check the output above."
    # Clean up created directory on failure
    rm -rf "$INSTALL_DIR"
    exit 1
fi

echo "Building production assets in ${INSTALL_DIR}..."
# Run npm run build as the target user
if ! su - "$TARGET_USER" -c "cd \"$INSTALL_DIR\" && $NPM_PATH run build"; then
    echo "Error: 'npm run build' failed. Please check the output above."
    rm -rf "$INSTALL_DIR"
    exit 1
fi
# --- End install and build ---

# --- Create systemd service file ---
echo "Creating systemd service file at ${SERVICE_FILE}..."

# Using a heredoc to create the service file content
cat > "$SERVICE_FILE" << EOL
[Unit]
Description=${SERVICE_DESCRIPTION}
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${TARGET_USER}
Group=$(id -gn "$TARGET_USER")
WorkingDirectory=${INSTALL_DIR}

# Load environment variables from .env file in the installation directory.
# systemd will silently ignore this directive if the file does not exist,
# but the application will likely fail to start without it.
EnvironmentFile=${INSTALL_DIR}/.env
Environment=NODE_ENV=production
KillMode=control-group
TimeoutStopSec=30

ExecStart=${NPM_PATH} run ${PROD_SERVER_SCRIPT_NAME}

Restart=on-failure
RestartSec=10

# Basic hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

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
echo "Service '${SERVICE_NAME}' has been installed and started."
echo ""
echo "The application is now running from: ${INSTALL_DIR}"
echo ""
echo "IMPORTANT:"
echo "-> To update the application, pull the latest changes in your source directory and re-run this install script."
echo "-> If the service fails, check that your '.env' file in ${INSTALL_DIR} is correctly configured."
echo ""
echo "You can check the service status with:"
echo "   sudo systemctl status ${SERVICE_NAME}"
echo ""
echo "You can view the logs with:"
echo "   sudo journalctl -u ${SERVICE_NAME} -f"
echo "---------------------------------------------------------"

exit 0
