# SQL Canvas - Docker Deployment

This application can be easily deployed using Docker for both development and production environments.

## Quick Start

### Production Deployment

Build and run the production container:

```bash
# Build the Docker image
docker build -t sql-canvas .

# Run the container
docker run -p 3000:80 sql-canvas
```

Or use Docker Compose:

```bash
# Build and run with docker-compose
docker-compose up --build

# Run in background
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`

### Development with Docker

For development with hot reload:

```bash
# Run development environment
docker-compose --profile dev up sql-canvas-dev
```

This will start the development server at `http://localhost:5173` with hot reload enabled.

## Docker Configuration

### Multi-stage Build

The Dockerfile uses a multi-stage build process:

1. **Builder stage**: Installs dependencies and builds the application using Node.js
2. **Production stage**: Serves the built application using nginx

### Features

- **Optimized for production**: Uses nginx for serving static files
- **Small image size**: Multi-stage build reduces final image size
- **SPA routing support**: Configured to handle client-side routing
- **Gzip compression**: Enabled for better performance
- **Security headers**: Includes security headers
- **Static asset caching**: Long-term caching for static assets

### Environment Variables

You can customize the deployment by setting environment variables:

```bash
# Custom port
docker run -p 8080:80 sql-canvas

# With environment variables (if needed in future)
docker run -p 3000:80 -e NODE_ENV=production sql-canvas
```

## File Structure

- `Dockerfile` - Multi-stage Docker build configuration
- `docker-compose.yml` - Docker Compose configuration for easy deployment
- `nginx.conf` - Custom nginx configuration for SPA support
- `.dockerignore` - Files to exclude from Docker build context

## Deployment Options

### Local Development
```bash
docker-compose --profile dev up
```

### Production
```bash
docker-compose up -d
```

### Cloud Deployment
The Docker image can be deployed to any cloud provider that supports containers:
- Docker Hub + any cloud service
- AWS ECS/EKS
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform

## Building for Different Architectures

```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t sql-canvas .
```

## Troubleshooting

### Dependency Version Compatibility

If you encounter dependency conflicts during build, the project has been configured with compatible versions:
- **Vite**: Uses v6.x instead of v7.x for compatibility with vite-plugin-solid
- **vite-plugin-solid**: Uses v2.10.2 which supports Vite 6.x

If you need to update dependencies in the future, ensure compatibility between Vite and vite-plugin-solid versions.

### PowerShell Commands

For Windows PowerShell users, use semicolons instead of `&&`:
```powershell
# Instead of: docker stop container && docker rm container
docker stop container; docker rm container
```
