# GateVault – Docker Setup & Hardened Deployment Guide

This document provides complete instructions for running the **GateVault – Smart Parcel Management and Secure Handover System** using hardened Docker and Docker Compose.

---

## 1. System Architecture in Docker

GateVault operates across isolated bridge networks with defense-in-depth containerization:

```mermaid
flowchart TD
    subgraph Host["Host Machine"]
        Browser["User Browser (http://localhost:3000)"]
        DirectAPI["Developer / External Client (http://localhost:8000)"]
    end

    subgraph FrontendNet["gatevault-frontend-net"]
        subgraph FrontendContainer["Frontend Service (gatevault-frontend:3000)"]
            Nginx["Hardened Nginx 1.27 Alpine\n(Non-Root: nginx UID 101)\n(server_tokens off + Security Headers)"]
            ReactApp["Compiled React 19 + Vite SPA"]
        end
    end

    subgraph BackendNet["gatevault-backend-net"]
        subgraph BackendContainer["Backend Service (gatevault-backend:8000)"]
            Gunicorn["Gunicorn WSGI (3 Workers)"]
            Django["Django 5.1 + REST Framework\n(Non-Root: gatevault UID 10001)\n(Multi-stage build, no compilers in runtime)"]
            Entrypoint["docker-entrypoint.sh\n(Migrate + Seed Community + CollectStatic)"]
        end

        subgraph DatabaseContainer["Database Service (gatevault-mysql:3306)"]
            MySQL["MySQL 8.0 Server\n(Internal Network Only - Zero External Port Exposure)\n(Non-Root User: gatevault_app)"]
        end
    end

    subgraph PersistentStorage["Host Persistent Storage"]
        DB[(backend/db.sqlite3)]
        Media[(backend/media/)]
        Backups[(backend/backups/)]
        MySQLData[(gatevault-mysql-data Volume)]
    end

    Browser -->|HTTP Port 3000| Nginx
    Nginx -->|Static Assets & SPA Fallback| ReactApp
    Nginx -->|Reverse Proxy /api/*| Gunicorn
    Nginx -->|Reverse Proxy /media/*| Gunicorn
    DirectAPI -.->|Optional Port 8000| Gunicorn
    Gunicorn --> Django
    Django --> DB
    Django --> Media
    Django --> Backups
    Django --> MySQL
    MySQL --> MySQLData
```

### Key Security Highlights
- **Least Privilege Execution**: Backend runs as `gatevault` (UID 10001), frontend runs as `nginx` (UID 101).
- **Kernel Capability Dropping**: All containers drop all Linux capabilities (`cap_drop: [ALL]`).
- **No Privilege Escalation**: Prevents setuid attacks (`security_opt: [no-new-privileges:true]`).
- **Network Segmentation**: Frontend cannot communicate directly with the database container.
- **Persistent Data**: SQLite (`backend/db.sqlite3`), media files (`backend/media/`), and backups (`backend/backups/`) survive container rebuilds.
- **Resource Constraints**: CPU limits (1.5 CPUs) and memory limits (1GB RAM) protect against resource exhaustion.

---

## 2. Quick-Start Commands

### A. Run with SQLite (Default Local Mode)
```powershell
# Navigate to project root
cd "c:\Users\saivi\OneDrive\Documents\Gate Vault"

# Build images and start containers
docker-compose up -d --build

# Verify container status
docker-compose ps
```

### B. Run with Dedicated MySQL 8.0 Container
```powershell
# Start with MySQL profile
docker-compose --profile mysql up -d --build
```

### C. Access Applications
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000/api/](http://localhost:8000/api/)
- **API Health Check**: [http://localhost:8000/api/towers/](http://localhost:8000/api/towers/)

### D. Useful Operational Commands
```powershell
# Tail live backend logs
docker-compose logs -f backend

# Tail live frontend logs
docker-compose logs -f frontend

# Create an on-demand database backup
docker-compose exec backend python manage.py backup_db

# Run migrations inside container
docker-compose exec backend python manage.py migrate

# Stop containers safely (preserves database records)
docker-compose stop
```

---

> [!CAUTION]
> **NEVER RUN `docker-compose down -v` IN PRODUCTION.**  
> Running `down -v` deletes named volumes and will erase your MySQL database volume. Always use `docker-compose stop` or `docker-compose down`.
