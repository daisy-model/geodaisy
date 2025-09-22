#!/usr/bin/env bash
# uninstall-service.sh

# --- Configuration ---
SERVICE_NAME="geodaisy"
INSTALL_DIR="/opt/${SERVICE_NAME}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
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

echo "Uninstalling service '${SERVICE_NAME}'..."

# --- Stop and disable the service ---
echo "Stopping service '${SERVICE_NAME}'..."
# It's safe to run stop even if the service is not running
systemctl stop "$SERVICE_NAME.service"

echo "Disabling service '${SERVICE_NAME}' from starting on boot..."
# It's safe to run disable even if the service is not enabled
systemctl disable "$SERVICE_NAME.service"
# --- End Stop and disable ---

# --- Remove systemd file ---
if [ -f "$SERVICE_FILE" ]; then
    echo "Removing systemd service file at ${SERVICE_FILE}..."
    rm "$SERVICE_FILE"
else
    echo "Service file ${SERVICE_FILE} not found. Skipping."
fi

echo "Reloading systemd daemon..."
systemctl daemon-reload
# --- End Remove systemd file ---

# --- Remove application files ---
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing installation directory ${INSTALL_DIR}..."
    rm -rf "$INSTALL_DIR"
else
    echo "Installation directory ${INSTALL_DIR} not found. Skipping."
fi
# --- End Remove application files ---

# --- Final Instructions ---
echo ""
echo "---------------------------------------------------------"
echo "Service '${SERVICE_NAME}' and its files have been uninstalled."
echo "---------------------------------------------------------"

exit 0
