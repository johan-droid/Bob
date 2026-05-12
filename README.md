# 🤖 Bob - Multi-Repo PR Health Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![WebSocket](https://img.shields.io/badge/websocket-enabled-brightgreen.svg)](https://socket.io/)

Production-grade GitHub PR health monitoring system with real-time WebSocket updates and mobile-optimized dashboard.

![Bob Dashboard](https://via.placeholder.com/800x400?text=Bob+Dashboard+Screenshot)

## ✨ Features

### 🔧 Backend
- ✅ **Multi-repo PR scanning** - Monitor unlimited repositories simultaneously
- ✅ **Merge conflict detection** - Automatic detection with retry logic
- ✅ **CI failure monitoring** - Track workflow run failures
- ✅ **WebSocket real-time updates** - Instant status changes without polling
- ✅ **Background scanning** - Automated scanning every 5 minutes
- ✅ **No API keys required** - Simple WebSocket connection
- ✅ **Auto-tagging** - Automatically tag `@jules-google-lab` team

### 🎨 Frontend
- ✅ **Real-time dashboard** - WebSocket-powered instant updates
- ✅ **Mobile-optimized** - Responsive design for all screen sizes
- ✅ **Connection status** - Visual indicator for WebSocket state
- ✅ **Four status categories:**
  - 🔴 **Active PR Resolution** - PRs awaiting response
  - 🟢 **Work in Progress** - PRs being resolved
  - 🔴 **Failed Resolution** - PRs that couldn't be fixed
  - ⚪ **History** - Successfully resolved PRs
- ✅ **Glowing indicators** - Beautiful animated status dots
- ✅ **Statistics overview** - Real-time metrics dashboard

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip package manager
- GitHub Personal Access Token ([Generate here](https://github.com/settings/tokens))

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/bob.git
cd bob

# 2. Install dependencies
cd backend
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your GitHub token and target repositories

# 4. Start the server
python api_server.py

# 5. Open your browser
# Navigate to http://localhost:5000
```

That's it! 🎉 No API keys, no separate frontend server needed.

## 📚 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 2 minutes
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Contributing](CONTRIBUTING.md)** - How to contribute to Bob
- **[Changelog](CHANGELOG.md)** - Version history and updates

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend Dashboard                      │
│  (Real-time PR status with glowing indicators)      │
└──────────────┬──────────────────────────────────────┘
               │ WebSocket (No API Key)
               ▼
┌─────────────────────────────────────────────────────┐
│              Flask + SocketIO Server                 │
│  (Manages PR status & broadcasts updates)            │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│              PR Health Scanner                       │
│  (Scans repos for conflicts & CI failures)           │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│              GitHub API                              │
│  (Multiple repositories)                             │
└─────────────────────────────────────────────────────┘
```

## 📡 WebSocket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `connect` | Establish connection, receive initial data |
| `request_update` | Request current PR data |
| `update_status` | Update PR status (pending/in_progress/failed/resolved) |

### Server → Client
| Event | Description |
|-------|-------------|
| `update` | Broadcast PR data to all clients |
| `scan_complete` | Notify when scan finishes |

## 🔄 PR Status Flow

```
┌─────────┐
│ pending │ 🔴 Red dot - Active PR Resolution
└────┬────┘
     │
     ▼
┌──────────────┐
│ in_progress  │ 🟢 Green glowing - Work in Progress
└────┬─────────┘
     │
     ├──────────┐
     ▼          ▼
┌──────────┐  ┌────────┐
│ resolved │  │ failed │
└──────────┘  └────────┘
⚪ Grey dot    🔴 Red dot
  History      Failed
```

## 📊 Dashboard Indicators

| Indicator | Status | Section | Description |
|-----------|--------|---------|-------------|
| 🔴 Red Dot | Pending | Active PR Resolution | PRs awaiting jules-google-lab response |
| 🟢 Green Glowing | In Progress | Work in Progress | PRs currently being resolved |
| 🔴 Red Glowing | Failed | Failed Resolution | PRs that couldn't be fixed |
| ⚪ Grey Glowing | Resolved | History | Successfully resolved PRs |

## ⚙️ Configuration

### Environment Variables

Create `backend/.env` from `backend/.env.example`:

```bash
# Required: GitHub Personal Access Token
GITHUB_TOKEN=ghp_your_token_here

# Required: Comma-separated list of repositories
TARGET_REPOS=org/repo1,org/repo2,org/repo3

# Optional: Server port (default: 5000)
PORT=5000

# Optional: Scan interval in seconds (default: 300)
SCAN_INTERVAL=300
```

### GitHub PAT Scopes

Your Personal Access Token needs these scopes:

- ✅ `repo` - Full control of private repositories
- ✅ `issues:write` - Create and update issues
- ✅ `pull_requests:write` - Create and update pull requests

[Generate token here](https://github.com/settings/tokens)

## 📱 Mobile Support

Bob is fully optimized for mobile devices:

- ✅ Responsive grid layout (2 columns on tablet, 1 on mobile)
- ✅ Touch-friendly interface
- ✅ Optimized font sizes for small screens
- ✅ Connection status indicator
- ✅ Viewport optimizations
- ✅ Works on iOS and Android

## 📁 Project Structure

```
Bob/
├── backend/                    # Backend server
│   ├── api_server.py          # Flask + SocketIO server
│   ├── pr_health_scanner.py   # PR scanner logic
│   ├── scanner.yml            # GitHub Actions workflow
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example          # Environment template
│   └── README.md             # Backend documentation
│
├── frontend/                   # Frontend dashboard
│   ├── index.html            # Dashboard UI
│   ├── styles.css            # Responsive styling
│   ├── app.js                # WebSocket client
│   └── README.md             # Frontend documentation
│
├── .gitignore                  # Git ignore rules
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guidelines
├── DEPLOYMENT.md               # Deployment guide
├── LICENSE                     # MIT License
├── QUICKSTART.md               # Quick start guide
└── README.md                   # This file
```

## 🔧 GitHub Actions Setup

Automate PR scanning with GitHub Actions:

### 1. Copy Workflow File
```bash
cp backend/scanner.yml .github/workflows/pr-health-scanner.yml
```

### 2. Configure Repository Secrets

Go to: `Settings > Secrets and variables > Actions`

Add:
- `ORG_PAT` - Organization-level GitHub Personal Access Token
- `OPENAI_KEY` - (Optional) For AI code review

### 3. Update Repository List

Edit `.github/workflows/pr-health-scanner.yml`:
```yaml
strategy:
  matrix:
    repo: 
      - your-org/repo-1
      - your-org/repo-2
      - your-org/repo-3
```

### 4. Enable Workflow

- Go to Actions tab
- Enable workflows
- Workflow runs automatically every 15 minutes

## 🐛 Troubleshooting

### Backend Issues

**WebSocket Connection Failed**
```bash
# Ensure Flask-SocketIO is installed
pip install flask-socketio python-socketio

# Check if port 5000 is available
lsof -i :5000  # Linux/Mac
netstat -ano | findstr :5000  # Windows
```

**GitHub Rate Limit**
- Use organization-level PAT for higher limits (5000 requests/hour)
- Check current rate limit:
```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit
```

**No PRs Found**
- Verify `TARGET_REPOS` format: `owner/repo,owner/repo`
- Check PAT has required scopes
- Ensure repositories exist and are accessible

### Frontend Issues

**Connection Status Red**
- Verify backend is running: `python api_server.py`
- Check browser console for errors (F12)
- Ensure port 5000 is not blocked by firewall

**Empty Dashboard**
- Wait for initial scan (5 minutes)
- Trigger manual scan: `POST http://localhost:5000/api/scan`
- Check backend logs for errors

**Mobile Layout Issues**
- Clear browser cache
- Ensure viewport meta tags are present
- Test in different browsers

## 🛠️ Maintenance

### Daily Tasks
- 👁️ Monitor dashboard for failed resolutions
- ✅ Verify `jules-google-lab` team receives notifications
- 📊 Review statistics for anomalies

### Weekly Tasks
- 📋 Review resolved PRs in history
- 🔄 Update PR statuses if needed
- 📈 Analyze trends in PR failures

### Monthly Tasks
- 🚀 Audit scan performance
- 🔄 Update dependencies: `pip install -r requirements.txt --upgrade`
- 🧹 Clean old resolved PRs
- 🔐 Rotate GitHub tokens

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

Maintained by the Bob team and contributors.

## 💬 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/bob/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-org/bob/discussions)
- 📧 **Email**: support@yourdomain.com

## ⭐ Star History

If you find Bob useful, please consider giving it a star! ⭐

## 🚀 Roadmap

### Version 1.1 (Planned)
- [ ] Database persistence (PostgreSQL/SQLite)
- [ ] User authentication
- [ ] Email notifications
- [ ] Slack integration
- [ ] Custom scan intervals per repository

### Version 1.2 (Future)
- [ ] PR status history tracking
- [ ] Advanced filtering and search
- [ ] Export functionality (CSV/JSON)
- [ ] Dark mode theme
- [ ] Multi-language support

### Version 2.0 (Vision)
- [ ] AI-powered PR analysis
- [ ] Predictive failure detection
- [ ] Integration with Jira/Linear
- [ ] Team performance analytics
- [ ] Custom webhooks

---

<div align="center">

**Made with ❤️ by the Bob team**

[Documentation](README.md) • [Quick Start](QUICKSTART.md) • [Deployment](DEPLOYMENT.md) • [Contributing](CONTRIBUTING.md)

</div>
