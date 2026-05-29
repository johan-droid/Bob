## 2024-05-24 - DOM-based HTML Escaping Vulnerability
**Vulnerability:** The `escHtml` function in `frontend/app.js` used a DOM-based approach (`textContent` to `innerHTML`) to escape HTML. This approach fails to escape single (`'`) and double (`"`) quotes, allowing XSS when the escaped output is used within HTML attributes (e.g., `<a href="${escHtml(url)}">`).
**Learning:** Never rely on DOM text-to-HTML conversion for secure escaping, especially when the output is placed inside HTML attributes. The browser does not consider quotes inside text content as special characters needing escaping.
**Prevention:** Always use explicit regex-based string replacements for the complete set of HTML special characters (`<`, `>`, `&`, `'`, `"`).
