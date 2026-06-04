# Getting started

## Environment

| ENV               | Description                                                                                                                                                                 |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SYSTEM_PASSWORD   | The password for the system user. Use this user for the first login. If the password is blank, Techanv Warden will automatically generate a random password.                   |
| ACCESS_TOKEN_KEY  | The access token key used to verify JWT access tokens. Example: 3afd551d-6882-4a59-8027-09d2f0f723ac                                                                        |
| REFRESH_TOKEN_KEY | The refresh token key used to verify JWT refresh tokens. The refresh token key should be different from the access token key. Example: 5cf90573-d3ad-4ce8-8801-59f9bc93c703 |

## Installation

### with docker

The Docker image is a great way to get up and running in a few minutes, as it comes with all dependencies pre-installed. Create `docker-compose.yml` file with content:

```yaml
services:
  warden:
    image: ghcr.io/sussec/warden:latest
    depends_on:
      - db
    environment:
      DB_SERVER: db
      DB_USERNAME: warden
      DB_PASSWORD: warden
      DB_NAME: warden
      SYSTEM_PASSWORD: "" # change system's password. Example: S3cur3Pa$$w0rd
      ACCESS_TOKEN_KEY: "" # change me
      REFRESH_TOKEN_KEY: "" # change refresh tokenkey. example: 5cf90573-d3ad-4ce8-8801-59f9bc93c703
    ports:
      - "8080:8080"
  db:
    image: postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-warden}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-warden}
      PGDATA: /data/postgres
    volumes:
      - warden_db:/data/postgres
    ports:
      - "54321:5432"
    restart: unless-stopped

volumes:
  warden_db:

```

Run docker compose

```bash
docker compose up -d
```

