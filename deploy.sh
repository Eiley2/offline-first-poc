#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

# Use docker-compose or docker compose based on availability
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Parse command line arguments
COMMAND=${1:-help}

case $COMMAND in
    up|start)
        print_info "Iniciando servicios..."
        $DOCKER_COMPOSE up -d
        print_info "Servicios iniciados correctamente"
        print_info "Aplicación disponible en: https://demo.plibots.dev"
        ;;
    
    down|stop)
        print_info "Deteniendo servicios..."
        $DOCKER_COMPOSE down
        print_info "Servicios detenidos"
        ;;
    
    restart)
        print_info "Reiniciando servicios..."
        $DOCKER_COMPOSE restart
        print_info "Servicios reiniciados"
        ;;
    
    build)
        print_info "Construyendo imágenes..."
        $DOCKER_COMPOSE build --no-cache
        print_info "Imágenes construidas correctamente"
        ;;
    
    rebuild)
        print_info "Reconstruyendo y reiniciando servicios..."
        $DOCKER_COMPOSE down
        $DOCKER_COMPOSE build --no-cache
        $DOCKER_COMPOSE up -d
        print_info "Servicios reconstruidos e iniciados"
        ;;
    
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            print_info "Mostrando logs de todos los servicios..."
            $DOCKER_COMPOSE logs -f
        else
            print_info "Mostrando logs de $SERVICE..."
            $DOCKER_COMPOSE logs -f $SERVICE
        fi
        ;;
    
    status)
        print_info "Estado de los servicios:"
        $DOCKER_COMPOSE ps
        ;;
    
    shell)
        SERVICE=${2:-app}
        print_info "Abriendo shell en $SERVICE..."
        $DOCKER_COMPOSE exec $SERVICE sh
        ;;
    
    clean)
        print_warning "Esto eliminará todos los contenedores, volúmenes y networks..."
        read -p "¿Estás seguro? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Limpiando..."
            $DOCKER_COMPOSE down -v
            docker system prune -f
            print_info "Limpieza completada"
        else
            print_info "Operación cancelada"
        fi
        ;;
    
    backup-certs)
        print_info "Haciendo backup de certificados SSL..."
        BACKUP_FILE="traefik/acme.json.backup-$(date +%Y%m%d-%H%M%S)"
        if [ -f "traefik/acme.json" ]; then
            cp traefik/acme.json "$BACKUP_FILE"
            print_info "Backup guardado en: $BACKUP_FILE"
        else
            print_warning "No se encontró traefik/acme.json"
        fi
        ;;
    
    restore-certs)
        BACKUP_FILE=${2:-}
        if [ -z "$BACKUP_FILE" ]; then
            print_error "Debes especificar el archivo de backup"
            print_info "Uso: $0 restore-certs <archivo-backup>"
            exit 1
        fi
        if [ ! -f "$BACKUP_FILE" ]; then
            print_error "Archivo de backup no encontrado: $BACKUP_FILE"
            exit 1
        fi
        print_info "Restaurando certificados desde: $BACKUP_FILE"
        cp "$BACKUP_FILE" traefik/acme.json
        chmod 600 traefik/acme.json
        $DOCKER_COMPOSE restart traefik
        print_info "Certificados restaurados y Traefik reiniciado"
        ;;
    
    check-dns)
        print_info "Verificando configuración DNS para demo.plibots.dev..."
        if command -v dig &> /dev/null; then
            dig demo.plibots.dev +short
        elif command -v nslookup &> /dev/null; then
            nslookup demo.plibots.dev
        else
            print_warning "No se encontró 'dig' ni 'nslookup'. Instala 'dnsutils' o 'bind-tools'"
        fi
        ;;
    
    check-ports)
        print_info "Verificando puertos 80 y 443..."
        if command -v netstat &> /dev/null; then
            netstat -tlnp | grep -E ':(80|443)'
        elif command -v ss &> /dev/null; then
            ss -tlnp | grep -E ':(80|443)'
        else
            print_warning "No se encontró 'netstat' ni 'ss'"
        fi
        ;;
    
    generate-password)
        print_info "Generando hash de contraseña para el dashboard de Traefik..."
        if command -v htpasswd &> /dev/null; then
            read -p "Ingresa el usuario [admin]: " USERNAME
            USERNAME=${USERNAME:-admin}
            read -s -p "Ingresa la contraseña: " PASSWORD
            echo
            HASH=$(echo $(htpasswd -nb "$USERNAME" "$PASSWORD") | sed -e s/\\$/\\$\\$/g)
            print_info "Hash generado (copia esto en docker-compose.yml):"
            echo "$HASH"
        else
            print_error "htpasswd no está instalado. Instala 'apache2-utils' (Debian/Ubuntu) o 'httpd-tools' (RHEL/CentOS)"
        fi
        ;;
    
    help|*)
        echo "Script de gestión de deployment con Traefik"
        echo ""
        echo "Uso: $0 [comando] [opciones]"
        echo ""
        echo "Comandos disponibles:"
        echo "  up|start              Inicia los servicios"
        echo "  down|stop             Detiene los servicios"
        echo "  restart               Reinicia los servicios"
        echo "  build                 Construye las imágenes"
        echo "  rebuild               Reconstruye todo desde cero"
        echo "  logs [servicio]       Muestra logs (todos o de un servicio específico)"
        echo "  status                Muestra el estado de los servicios"
        echo "  shell [servicio]      Abre una shell en el contenedor (default: app)"
        echo "  clean                 Limpia contenedores y volúmenes"
        echo "  backup-certs          Hace backup de los certificados SSL"
        echo "  restore-certs <file>  Restaura certificados desde un backup"
        echo "  check-dns             Verifica la configuración DNS"
        echo "  check-ports           Verifica qué está usando los puertos 80 y 443"
        echo "  generate-password     Genera hash de contraseña para el dashboard"
        echo "  help                  Muestra esta ayuda"
        echo ""
        echo "Ejemplos:"
        echo "  $0 up                 # Inicia todos los servicios"
        echo "  $0 logs traefik       # Ver logs de Traefik"
        echo "  $0 shell app          # Abrir shell en el contenedor de la app"
        echo "  $0 backup-certs       # Hacer backup de certificados"
        ;;
esac
