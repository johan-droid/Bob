## 2025-05-30 - Fix XSS Vulnerability in DOM-based HTML Escaping
**Vulnerability:** Cross-Site Scripting (XSS) vulnerability via insecure `escHtml` function implementation in `frontend/app.js`. The function relied on setting `textContent` and reading `innerHTML` of a temporary DOM element.
**Learning:** Using DOM methods like `textContent` and `innerHTML` for escaping HTML is unsafe because it fails to escape single (`'`) and double (`"`) quotes. This leaves attributes vulnerable to XSS if the escaped string is dynamically inserted into an HTML attribute context.
**Prevention:** Always use explicit regex-based string replacements for `<`, `>`, `&`, `'`, and `"` when implementing HTML escaping logic on the frontend to ensure all characters that can break out of HTML contexts are sanitized.
