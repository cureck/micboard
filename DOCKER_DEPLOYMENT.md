# Docker Deployment Guide

This guide covers deploying Micboard using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 1GB RAM available for the container
- Port 8058 available on the host

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/karlcswanson/micboard.git
   cd micboard
   ```

2. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   Open your browser to `http://localhost:8058`

## Configuration

### Persistent Data

The Docker setup uses named volumes for persistent data:

- `micboard_config`: Stores application configuration and settings
- `micboard_logs`: Stores application logs

### Environment Variables

You can customize the deployment using environment variables in `docker-compose.yaml`:

```yaml
environment:
  - PYTHONUNBUFFERED=1
  - LOG_LEVEL=INFO
  - PCO_CLIENT_ID=your_client_id
  - PCO_CLIENT_SECRET=your_client_secret
```

### Port Configuration

To change the port, modify the `docker-compose.yaml` file:

```yaml
ports:
  - '8080:8058'  # Maps host port 8080 to container port 8058
```

## Management Commands

### View Logs
```bash
docker-compose logs -f micboard
```

### Restart Service
```bash
docker-compose restart micboard
```

### Stop Service
```bash
docker-compose down
```

### Update Service
```bash
git pull
docker-compose build --no-cache
docker-compose up -d
```

### Access Container Shell
```bash
docker-compose exec micboard bash
```

## Health Monitoring

The container includes a health check that monitors the application status:

- **Check Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start Period**: 40 seconds

View health status:
```bash
docker-compose ps
```

## Security Considerations

- The container runs as a non-root user (`micboard`)
- Configuration data is stored in named volumes
- No sensitive data is stored in the image
- Health checks help ensure service availability

## Troubleshooting

### Container Won't Start
1. Check logs: `docker-compose logs micboard`
2. Verify port 8058 is available: `netstat -tulpn | grep 8058`
3. Check disk space: `df -h`

### Application Not Responding
1. Check health status: `docker-compose ps`
2. Restart the container: `docker-compose restart micboard`
3. Check application logs for errors

### Configuration Issues
1. Access container: `docker-compose exec micboard bash`
2. Check config directory: `ls -la /home/micboard/.local/share/micboard`
3. Verify file permissions

## Production Deployment

For production deployment, consider:

1. **Use a reverse proxy** (nginx, Traefik) for SSL termination
2. **Set up log rotation** for the logs volume
3. **Configure monitoring** (Prometheus, Grafana)
4. **Use secrets management** for sensitive configuration
5. **Set up automated backups** for the config volume

### Example nginx configuration:
```nginx
server {
    listen 80;
    server_name micboard.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8058;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/karlcswanson/micboard/issues
- Documentation: https://github.com/karlcswanson/micboard/blob/main/README.md
