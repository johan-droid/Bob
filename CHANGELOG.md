# Changelog

All notable changes to Bob - Multi-Repo PR Health Monitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Real-time WebSocket support for instant PR status updates
- Mobile-optimized responsive dashboard
- Connection status indicator
- Background scanning every 5 minutes
- Multi-repo PR health monitoring
- Merge conflict detection
- CI failure monitoring
- Auto-tagging for `@jules-google-lab` team
- Four status categories:
  - Active PR Resolution (pending)
  - Work in Progress (in_progress)
  - Failed Resolution (failed)
  - History (resolved)
- Glowing status indicators (red, green, grey)
- Statistics overview dashboard
- GitHub Actions workflow for automated scanning
- Flask + SocketIO backend server
- No API key authentication required

### Features
- **Backend**
  - Flask server with WebSocket support
  - PR health scanner with retry logic
  - GitHub API integration
  - Background scanning thread
  - Real-time broadcast to all clients
  
- **Frontend**
  - Real-time dashboard with WebSocket
  - Mobile-first responsive design
  - Touch-friendly interface
  - Connection status indicator
  - Auto-reconnect on disconnect
  - XSS protection with HTML escaping

### Documentation
- Comprehensive README with setup instructions
- Quick start guide
- Contributing guidelines
- Backend and frontend specific documentation
- GitHub Actions workflow documentation

## [Unreleased]

### Planned Features
- Database persistence for PR status
- User authentication (optional)
- Email notifications
- Slack integration
- Custom scan intervals per repository
- PR status history tracking
- Advanced filtering and search
- Export functionality
- Dark mode theme
- Multi-language support

---

## Version History

- **1.0.0** - Initial release with WebSocket support and mobile optimization
