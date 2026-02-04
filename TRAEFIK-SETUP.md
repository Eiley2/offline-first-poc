# Traefik Setup para demo.plibots.dev

## Descripción

Esta configuración utiliza Traefik v3 como reverse proxy para manejar el tráfico HTTPS hacia la aplicación offline-first.

## Características

- ✅ Certificados SSL automáticos con Let's Encrypt
- ✅ Redirección automática HTTP → HTTPS
- ✅ Dashboard de Traefik (opcional, en `traefik.demo.plibots.dev`)
- ✅ Headers de seguridad configurados
- ✅ Docker Compose para fácil deployment

## Configuración de DNS

Antes de iniciar, asegúrate de que los siguientes registros DNS estén configurados:

```
demo.plibots.dev           A    <TU_IP_SERVIDOR>
*.demo.plibots.dev         A    <TU_IP_SERVIDOR>
```

O alternativamente:
```
demo.plibots.dev           A    <TU_IP_SERVIDOR>
traefik.demo.plibots.dev   A    <TU_IP_SERVIDOR>
```

## Requisitos Previos

- Docker y Docker Compose instalados
- Puertos 80 y 443 abiertos en el firewall
- Dominio `demo.plibots.dev` apuntando a tu servidor

## Estructura de Archivos

```
.
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
└── traefik/
    ├── traefik.yml      # Configuración principal de Traefik
    ├── config.yml       # Middlewares y configuraciones adicionales
    └── acme.json        # Almacenamiento de certificados SSL (generado automáticamente)
```

## Uso

### 1. Iniciar los servicios

```bash
docker-compose up -d
```

### 2. Ver los logs

```bash
# Ver logs de Traefik
docker-compose logs -f traefik

# Ver logs de la aplicación
docker-compose logs -f app
```

### 3. Verificar el estado

```bash
docker-compose ps
```

## Acceso

- **Aplicación principal**: https://demo.plibots.dev
- **Dashboard de Traefik** (opcional): https://traefik.demo.plibots.dev
  - Usuario: `admin`
  - Contraseña: Configurar en `docker-compose.yml` (ver sección de seguridad)

## Seguridad del Dashboard

Para acceder al dashboard de Traefik, necesitas generar un hash de contraseña:

```bash
# Instalar htpasswd si no lo tienes
sudo apt-get install apache2-utils

# Generar hash de contraseña
echo $(htpasswd -nb admin tucontraseña) | sed -e s/\\$/\\$\\$/g
```

Luego reemplaza el valor en `docker-compose.yml`:
```yaml
- "traefik.http.middlewares.traefik-auth.basicauth.users=admin:$$apr1$$yourhashedpassword"
```

## Comandos Útiles

### Reconstruir la aplicación
```bash
docker-compose up -d --build app
```

### Reiniciar Traefik
```bash
docker-compose restart traefik
```

### Detener todos los servicios
```bash
docker-compose down
```

### Renovar certificados manualmente
Los certificados se renuevan automáticamente, pero si necesitas forzar una renovación:
```bash
docker-compose restart traefik
```

## Troubleshooting

### Los certificados SSL no se generan

1. Verifica que los puertos 80 y 443 estén accesibles:
   ```bash
   sudo netstat -tlnp | grep -E ':(80|443)'
   ```

2. Verifica los logs de Traefik:
   ```bash
   docker-compose logs traefik | grep -i acme
   ```

3. Asegúrate de que el DNS esté correctamente configurado:
   ```bash
   dig demo.plibots.dev
   ```

### La aplicación no responde

1. Verifica que el contenedor esté corriendo:
   ```bash
   docker-compose ps
   ```

2. Verifica los logs de la aplicación:
   ```bash
   docker-compose logs app
   ```

3. Verifica la configuración de red:
   ```bash
   docker network inspect proxy
   ```

### Error "Cannot connect to Docker daemon"

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Configuración Avanzada

### Cambiar el puerto de la aplicación

Si tu aplicación usa un puerto diferente a 3000, actualiza en `docker-compose.yml`:

```yaml
- "traefik.http.services.app.loadbalancer.server.port=NUEVO_PUERTO"
```

### Agregar más dominios

Edita las labels en `docker-compose.yml`:

```yaml
- "traefik.http.routers.app-secure.rule=Host(`demo.plibots.dev`) || Host(`otro.dominio.com`)"
```

### Configurar rate limiting

Agrega en `traefik/config.yml`:

```yaml
http:
  middlewares:
    rate-limit:
      rateLimit:
        average: 100
        burst: 50
```

## Variables de Entorno

Puedes crear un archivo `.env` para gestionar variables:

```env
DOMAIN=demo.plibots.dev
ACME_EMAIL=esanchez@plibots.com
APP_PORT=3000
```

## Backup

Asegúrate de hacer backup regular de:
- `traefik/acme.json` - Contiene los certificados SSL
- Tu base de datos (si aplica)

```bash
# Backup
cp traefik/acme.json traefik/acme.json.backup

# Restaurar
cp traefik/acme.json.backup traefik/acme.json
docker-compose restart traefik
```

## Contacto

Email de Let's Encrypt configurado: **esanchez@plibots.com**

## Referencias

- [Documentación de Traefik](https://doc.traefik.io/traefik/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Docker Compose](https://docs.docker.com/compose/)
