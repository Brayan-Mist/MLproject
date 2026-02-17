#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"

# Railway can restore a filesystem layer where more than one MPM is enabled.
# Force a single MPM at runtime before Apache starts.
echo "Apache MPM modules before cleanup:"
ls -1 /etc/apache2/mods-enabled/mpm_*.load 2>/dev/null || true
a2dismod mpm_event >/dev/null 2>&1 || true
a2dismod mpm_worker >/dev/null 2>&1 || true
rm -f /etc/apache2/mods-enabled/mpm_event.load /etc/apache2/mods-enabled/mpm_event.conf
rm -f /etc/apache2/mods-enabled/mpm_worker.load /etc/apache2/mods-enabled/mpm_worker.conf
a2enmod mpm_prefork >/dev/null 2>&1 || true
echo "Apache MPM modules after cleanup:"
ls -1 /etc/apache2/mods-enabled/mpm_*.load 2>/dev/null || true

sed -ri "s/Listen [0-9]+/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \\*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
