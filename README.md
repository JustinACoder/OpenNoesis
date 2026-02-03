# OpenDebate
A place to have meaningful debates (at least, most of the time...)

## 🚀 Features
- Real-time debates with WebSocket support
- User authentication and profiles
- Debate pairing system
- Notifications
- Discussion management
- Background task processing with Celery

## 🏗️ Tech Stack

### Backend
- **Django 5.0** - Web framework
- **Django Channels** - WebSocket support
- **Celery** - Background task processing
- **PostgreSQL** - Database
- **Redis** - Caching and message broker
- **Django Ninja** - API framework

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **React Query** - Data fetching
- **Shadcn/ui** - UI components

## 📦 Quick Start

### Development Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env.dev
# Edit .env.dev with your local settings

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

#### Frontend
```bash
cd frontend
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your settings

# Run development server
npm run dev
```

### Using Docker

#### Development (with live reloading)
```bash
# Quick start - uses Django runserver and Next.js dev server
./dev.sh          # Linux/Mac/WSL

# Or manually
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Development features:**
- ✅ Live code reloading (backend & frontend)
- ✅ Django runserver with debug toolbar
- ✅ Next.js dev server with Turbopack HMR
- ✅ Volume mounts for instant code changes
- ✅ Detailed error messages and logging

#### Production
```bash
# Build and start all services
docker compose up -d

# Run migrations
docker exec debate-backend python manage.py migrate

# Create superuser
docker exec -it debate-backend python manage.py createsuperuser
```

## 🚢 Deployment

We use a **Blue-Green deployment strategy** with Docker for zero-downtime deployments.

### Quick Deployment Guide
See [QUICKSTART.md](./QUICKSTART.md) for a condensed setup guide.

### Full Deployment Documentation
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for comprehensive deployment instructions.

### Key Features
- ✅ Zero-downtime deployments
- ✅ Automatic health checks
- ✅ Instant rollback capability
- ✅ CI/CD with GitHub Actions
- ✅ Docker containerization
- ✅ SSL/HTTPS support
- ✅ Automated testing before deployment

## 🧪 Testing

### Backend Tests
```bash
cd backend
python manage.py test
```

### Frontend Linting
```bash
cd frontend
npm run lint
```

### CI/CD
Tests run automatically on every push to `dev` and `master` branches via GitHub Actions.

## 📝 Environment Variables

### Backend (.env.prod or .env.dev)
```env
SECRET_KEY=your-secret-key
ENV=prod  # or dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=debate_prod
DB_USER=debate_user
DB_PASSWORD=your-password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
# ... see backend/.env.example for all variables
```

### Frontend (.env.production or .env.local)
```env
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws/
DOCKER_API_URL=http://backend:8000
```

## 📚 Project Structure
```
ProjectOpenDebate/
├── backend/
│   ├── debate/          # Core debate functionality
│   ├── debateme/        # Debate invitations
│   ├── discussion/      # Discussion management
│   ├── notifications/   # User notifications
│   ├── pairing/         # User pairing system
│   ├── users/           # User management
│   └── ProjectOpenDebate/  # Main project settings
├── frontend/
│   └── src/
│       ├── app/         # Next.js app router
│       ├── components/  # React components
│       └── lib/         # Utilities and API clients
├── deploy.sh           # Blue-green deployment script
├── rollback.sh         # Rollback script
├── docker-compose.yml  # Docker services configuration
└── .github/
    └── workflows/      # GitHub Actions CI/CD
```

## 🛠️ Development Commands

### Using Makefile
```bash
make build          # Build Docker images
make up             # Start all containers
make down           # Stop all containers
make logs           # View logs
make migrate        # Run migrations
make shell          # Open Django shell
make test-backend   # Run Django tests
make test-frontend  # Run frontend linting
make health         # Check health of all services
```

### Manual Commands
```bash
# Backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic
python manage.py test

# Frontend
npm run dev        # Development server
npm run build      # Production build
npm run lint       # Linting
npm start          # Production server

# Celery
celery -A ProjectOpenDebate worker -l info
celery -A ProjectOpenDebate beat -l info
```

## 🔒 Security

- SSL/TLS encryption (Let's Encrypt)
- CSRF protection
- CORS configuration
- Rate limiting via Nginx
- Secure password hashing
- Environment variables for secrets
- Docker container isolation

## 📊 Monitoring

### View Logs
```bash
docker compose logs -f [service_name]
```

### Access Django Admin
Navigate to `https://your-domain.com/admin/`

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

See [LICENSE](./LICENSE) file for details.

## 🐛 Issues & Support

For bugs and feature requests, please use the [GitHub Issues](https://github.com/YOUR_USERNAME/YOUR_REPO/issues) page.

## 🙏 Acknowledgments

- Django and Next.js communities
- All contributors to this project


