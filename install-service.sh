#!/usr/bin/env bash
set -euo pipefail
# install-service.sh

# --- Configuration ---
SERVICE_NAME="geodaisy"
SERVICE_DESCRIPTION="Geodaisy the webpage"
PROD_SERVER_SCRIPT_NAME="start-prod-server"
INSTALL_DIR="/opt/${SERVICE_NAME}"
SERVICE_USER="${SERVICE_USER:-${SERVICE_NAME}}"
SERVICE_GROUP="${SERVICE_GROUP:-${SERVICE_USER}}"
# --- End Configuration ---

usage() {
  cat <<'EOF'
Usage: sudo SERVICE_USER=<user> bash install-service.sh [--systemd | --docker]

Options (mutually exclusive):
  --systemd    Install/update the application as a systemd service (default service user: $SERVICE_USER)
  --docker     Install/update the application using Docker Compose (default APP_ENV=production)
  -h, --help   Show this help message

The script keeps a record of the last deployment mode in ${INSTALL_DIR}/.deployment_mode
and will warn when switching between systemd and docker installations.
EOF
}

require_commands() {
  local missing=()
  for dep in "$@"; do
    if ! command -v "$dep" >/dev/null 2>&1; then
      missing+=("$dep")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Error: Missing required command(s): ${missing[*]}" >&2
    exit 1
  fi
}

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    echo "Error: Docker Compose plugin (docker compose) or docker-compose binary not found." >&2
    exit 1
  fi
}

warn_conflicts() {
  local target_mode="$1"
  if [ -n "$EXISTING_MODE" ] && [ "$EXISTING_MODE" != "$target_mode" ]; then
    echo "Warning: Previous deployment recorded as '${EXISTING_MODE}' in ${INSTALL_DIR}." >&2
    echo "         Installing '${target_mode}' may conflict with the existing setup." >&2
  fi

  case "$target_mode" in
    systemd)
      if command -v docker >/dev/null 2>&1; then
        if docker ps --format '{{.Names}}' | grep -Eq "^${SERVICE_NAME}([-_]|$)"; then
          echo "Warning: Detected running Docker container(s) named '${SERVICE_NAME}'. Stop them before switching to systemd." >&2
        fi
      fi
      ;;
    docker)
      if command -v systemctl >/dev/null 2>&1; then
        if systemctl list-units --full --all | grep -Fq "${SERVICE_NAME}.service"; then
          echo "Warning: Detected existing systemd unit '${SERVICE_NAME}.service'. Disable it to avoid clashes with Docker deployment." >&2
        fi
      fi
      ;;
  esac
}

write_deployment_mode() {
  local mode="$1"
  echo "$mode" > "${INSTALL_DIR}/.deployment_mode"
  chmod 0644 "${INSTALL_DIR}/.deployment_mode"
}

install_systemd() {
  require_commands rsync systemctl useradd groupadd su

  local target_user="$SERVICE_USER"
  local target_group="$SERVICE_GROUP"
  local service_file="/etc/systemd/system/${SERVICE_NAME}.service"

  echo "Installing service for user: ${target_user}"
  echo "Source directory: ${SOURCE_DIR}"
  echo "Installation directory: ${INSTALL_DIR}"

  if id "$target_user" >/dev/null 2>&1; then
    target_group=$(id -gn "$target_user")
  else
    if ! getent group "$target_group" >/dev/null; then
      echo "Creating system group '${target_group}'..."
      groupadd --system "$target_group"
    fi
    echo "Creating system user '${target_user}'..."
    useradd --system --gid "$target_group" --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin --no-create-home "$target_user"
  fi

  echo "Creating installation directory..."
  install -d -m 0755 -o "$target_user" -g "$target_group" "$INSTALL_DIR"

  echo "Copying application files to ${INSTALL_DIR}..."
  rsync -a --delete \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude="install-service.sh" \
    --exclude=".deployment_mode" \
    "${SOURCE_DIR}/" "${INSTALL_DIR}/"

  if [ -f "${SOURCE_DIR}/.env" ]; then
      echo "Copying .env file..."
      cp "${SOURCE_DIR}/.env" "${INSTALL_DIR}/.env"
  else
      echo "Warning: '.env' file not found in source directory."
      echo "The service will likely fail to start. You may need to create it manually at ${INSTALL_DIR}/.env"
  fi

  echo "Setting ownership for ${INSTALL_DIR}..."
  chown -R "$target_user:$target_group" "$INSTALL_DIR"

  echo "Locating npm for '${target_user}'..."
  local npm_path
  npm_path=$(su - "$target_user" -s /bin/sh -c 'command -v npm' || true)

  if [ -z "$npm_path" ]; then
      echo "Error: Could not find 'npm' in the path for user '${target_user}'." >&2
      echo "Please ensure Node.js and npm are installed and available in the user's PATH." >&2
      echo "You can override the service user by running: SERVICE_USER=<your-user> sudo bash $0 --systemd" >&2
      exit 1
  fi
  echo "Found npm at: ${npm_path}"

  echo "Installing production dependencies in ${INSTALL_DIR}..."
  if ! su - "$target_user" -s /bin/sh -c "cd \"$INSTALL_DIR\" && $npm_path ci --omit=dev"; then
      echo "Error: 'npm ci' failed. Please check the output above." >&2
      rm -rf "$INSTALL_DIR"
      exit 1
  fi

  echo "Building production assets in ${INSTALL_DIR}..."
  if ! su - "$target_user" -s /bin/sh -c "cd \"$INSTALL_DIR\" && $npm_path run build"; then
      echo "Error: 'npm run build' failed. Please check the output above." >&2
      rm -rf "$INSTALL_DIR"
      exit 1
  fi

  echo "Creating systemd service file at ${service_file}..."
  cat > "$service_file" <<EOL
[Unit]
Description=${SERVICE_DESCRIPTION}
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${target_user}
Group=${target_group}
WorkingDirectory=${INSTALL_DIR}

# Load environment variables from .env file in the installation directory.
# systemd will silently ignore this directive if the file does not exist,
# but the application will likely fail to start without it.
EnvironmentFile=-${INSTALL_DIR}/.env
Environment=NODE_ENV=production
Environment=PATH=$(dirname "$npm_path"):/usr/local/bin:/usr/bin
KillMode=control-group
TimeoutStopSec=30

ExecStart=${npm_path} run ${PROD_SERVER_SCRIPT_NAME}

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

  echo "Reloading systemd daemon..."
  systemctl daemon-reload

  echo "Enabling service '${SERVICE_NAME}' to start on boot..."
  systemctl enable "$SERVICE_NAME.service"

  echo "Starting service '${SERVICE_NAME}'..."
  systemctl start "$SERVICE_NAME.service"

  write_deployment_mode "systemd"
  chown "$target_user:$target_group" "${INSTALL_DIR}/.deployment_mode"

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
}

install_docker() {
  require_commands rsync docker
  resolve_compose_cmd

  echo "Preparing Docker deployment"
  echo "Source directory: ${SOURCE_DIR}"
  echo "Installation directory: ${INSTALL_DIR}"

  install -d -m 0755 "$INSTALL_DIR"

  echo "Syncing project files to ${INSTALL_DIR}..."
  rsync -a --delete \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude="install-service.sh" \
    --exclude=".deployment_mode" \
    "${SOURCE_DIR}/" "${INSTALL_DIR}/"

  if [ -f "${SOURCE_DIR}/.env" ]; then
      echo "Copying .env file..."
      cp "${SOURCE_DIR}/.env" "${INSTALL_DIR}/.env"
  else
      echo "Warning: '.env' file not found in source directory."
      echo "The Docker stack will require ${INSTALL_DIR}/.env to start correctly."
  fi

  write_deployment_mode "docker"

  local desired_env
  desired_env="${APP_ENV:-production}"

  echo "Bringing up Docker Compose stack (APP_ENV=${desired_env})..."
  (
    cd "$INSTALL_DIR"
    APP_ENV="$desired_env" "${COMPOSE_CMD[@]}" up --build -d
  )

  echo ""
  echo "---------------------------------------------------------"
  echo "Docker deployment for '${SERVICE_NAME}' is up."
  echo ""
  echo "Stack root: ${INSTALL_DIR}"
  echo ""
  echo "Next steps:"
  echo "-> Use 'APP_ENV=development docker compose up --build' for hot reload, or set APP_ENV=production for hardened mode."
  echo "-> Provide CLOUDFLARE_TUNNEL_TOKEN before rerunning the script if you plan to expose the service via Cloudflare." 
  echo ""
  echo "You can monitor the stack with:"
  echo "   docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
  echo ""
  echo "To stop the stack:"
  echo "   APP_ENV=${desired_env} docker compose -f ${INSTALL_DIR}/docker-compose.yml down"
  echo "---------------------------------------------------------"
}

MODE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --systemd)
      if [ -n "$MODE" ]; then
        echo "Error: Options --systemd and --docker are mutually exclusive." >&2
        exit 1
      fi
      MODE="systemd"
      ;;
    --docker)
      if [ -n "$MODE" ]; then
        echo "Error: Options --systemd and --docker are mutually exclusive." >&2
        exit 1
      fi
      MODE="docker"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$1'" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [ -z "$MODE" ]; then
  echo "Error: You must specify either --systemd or --docker." >&2
  usage
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root. Please use 'sudo'." >&2
  exit 1
fi

SOURCE_DIR=$(pwd)

EXISTING_MODE=""
if [ -f "${INSTALL_DIR}/.deployment_mode" ]; then
  EXISTING_MODE=$(<"${INSTALL_DIR}/.deployment_mode")
fi

warn_conflicts "$MODE"

case "$MODE" in
  systemd)
    install_systemd
    ;;
  docker)
    install_docker
    ;;
esac

exit 0
