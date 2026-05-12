# Contributing to Bob

Thank you for your interest in contributing to Bob - Multi-Repo PR Health Monitor!

## Development Setup

### Prerequisites
- Python 3.8+
- Git
- GitHub Personal Access Token with appropriate scopes

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/your-org/bob.git
cd bob
```

2. **Set up backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
```

3. **Run the server**
```bash
python api_server.py
```

4. **Access the dashboard**
Open `http://localhost:5000` in your browser

## Project Structure

```
Bob/
├── backend/
│   ├── api_server.py          # Flask + SocketIO server
│   ├── pr_health_scanner.py   # PR scanning logic
│   ├── scanner.yml            # GitHub Actions workflow
│   ├── requirements.txt       # Python dependencies
│   └── .env.example          # Environment template
├── frontend/
│   ├── index.html            # Dashboard UI
│   ├── styles.css            # Responsive styling
│   └── app.js                # WebSocket client
└── README.md                 # Documentation
```

## Making Changes

### Backend Changes

1. **Add new features to `api_server.py`**
   - Follow Flask best practices
   - Use WebSocket events for real-time updates
   - Add error handling

2. **Update scanner logic in `pr_health_scanner.py`**
   - Maintain retry logic for GitHub API
   - Handle rate limiting gracefully
   - Add comprehensive error messages

### Frontend Changes

1. **Update UI in `index.html`**
   - Maintain semantic HTML structure
   - Ensure accessibility compliance

2. **Style changes in `styles.css`**
   - Mobile-first approach
   - Test on multiple screen sizes
   - Maintain consistent design language

3. **JavaScript updates in `app.js`**
   - Use WebSocket for all real-time updates
   - Handle connection errors gracefully
   - Escape user input to prevent XSS

## Testing

### Manual Testing
1. Start the server
2. Open dashboard in multiple browsers
3. Verify real-time updates work across all clients
4. Test on mobile devices
5. Test connection/disconnection scenarios

### GitHub Actions Testing
1. Deploy `scanner.yml` to a test repository
2. Verify automated scanning works
3. Check issue creation and labeling

## Code Style

### Python
- Follow PEP 8 guidelines
- Use meaningful variable names
- Add docstrings to functions
- Keep functions focused and small

### JavaScript
- Use ES6+ features
- Add comments for complex logic
- Handle errors gracefully
- Escape HTML to prevent XSS

### CSS
- Mobile-first responsive design
- Use CSS variables for theming
- Maintain consistent spacing
- Comment complex selectors

## Submitting Changes

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
   - Write clear commit messages
   - Keep commits focused and atomic

3. **Test thoroughly**
   - Test on multiple browsers
   - Test on mobile devices
   - Verify WebSocket functionality

4. **Submit a pull request**
   - Describe your changes clearly
   - Reference any related issues
   - Include screenshots for UI changes

## Reporting Issues

When reporting issues, please include:
- Bob version
- Python version
- Browser and version (for frontend issues)
- Steps to reproduce
- Expected vs actual behavior
- Error messages or logs

## Feature Requests

We welcome feature requests! Please:
- Check existing issues first
- Describe the use case clearly
- Explain why it would benefit users
- Consider implementation complexity

## Questions?

Feel free to open an issue for questions or join our discussions.

Thank you for contributing to Bob! 🤖
