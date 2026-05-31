## 2024-05-31 - [DOM-based HTML Escaping XSS Vulnerability]
**Vulnerability:** The `escHtml()` function used `textContent` and `innerHTML` for escaping.
**Learning:** This DOM-based method fails to escape single and double quotes, leaving attributes (e.g., `href="${escHtml(...)}"`) vulnerable to XSS attacks.
**Prevention:** Always use explicit regex-based string replacements for `<`, `>`, `&`, `'`, and `"` when implementing HTML escaping functions.
