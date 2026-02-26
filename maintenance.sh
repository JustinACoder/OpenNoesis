#!/bin/bash
# Maintenance Mode Helper Script
# Manually enable/disable maintenance mode

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NGINX_CONFIG="/etc/nginx/sites-available/opennoesis"

case "$1" in
    enable)
        echo -e "${YELLOW}Enabling maintenance mode...${NC}"
        sed -i 's/# MAINTENANCE_MODE_DISABLED/# MAINTENANCE_MODE_ENABLED/' "$NGINX_CONFIG"
        sed -i '/# MAINTENANCE_MODE_ENABLED/,/# END_MAINTENANCE_MODE/ s/^#//' "$NGINX_CONFIG"
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            echo -e "${GREEN}Maintenance mode enabled!${NC}"
            echo -e "Users will see the maintenance page."
        else
            echo -e "${RED}nginx config test failed!${NC}"
            exit 1
        fi
        ;;
    disable)
        echo -e "${YELLOW}Disabling maintenance mode...${NC}"
        sed -i 's/# MAINTENANCE_MODE_ENABLED/# MAINTENANCE_MODE_DISABLED/' "$NGINX_CONFIG"
        sed -i '/# MAINTENANCE_MODE_DISABLED/,/# END_MAINTENANCE_MODE/ s/^/#/' "$NGINX_CONFIG"
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            echo -e "${GREEN}Maintenance mode disabled!${NC}"
            echo -e "Users can access the application."
        else
            echo -e "${RED}nginx config test failed!${NC}"
            exit 1
        fi
        ;;
    status)
        if grep -q "# MAINTENANCE_MODE_ENABLED" "$NGINX_CONFIG"; then
            echo -e "${YELLOW}Maintenance mode: ENABLED${NC}"
            echo "Users see the maintenance page."
        else
            echo -e "${GREEN}Maintenance mode: DISABLED${NC}"
            echo "Application is serving normally."
        fi
        ;;
    *)
        echo "Usage: $0 {enable|disable|status}"
        echo ""
        echo "  enable  - Enable maintenance mode (show maintenance page)"
        echo "  disable - Disable maintenance mode (serve application)"
        echo "  status  - Check if maintenance mode is active"
        exit 1
        ;;
esac

