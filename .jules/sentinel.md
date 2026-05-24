## 2025-02-09 - [Fix XSS Vulnerability]
**Vulnerability:** XSS vulnerability in frontend/app.js where single and double quotes inside `href` attributes were not properly escaped.
**Learning:** `document.createElement('div').textContent = ...` escapes `<`, `>`, and `&`, but fails to escape quotes (`"` and `'`), making it vulnerable to injection within HTML attributes.
**Prevention:** Use a regex-based `escapeHtml` function to effectively close the XSS vector by escaping `&`, `<`, `>`, `"`, and `'`.
