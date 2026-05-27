## 2024-05-27 - [Flawed escHtml Implementation causing XSS]
**Vulnerability:** The `escHtml` function in `frontend/app.js` used a DOM-based approach (`document.createElement('div').textContent = s; return d.innerHTML;`) to escape HTML. This method does not escape single (`'`) or double (`"`) quotes.
**Learning:** Because it doesn't escape quotes, values passed to `escHtml` that are then interpolated inside HTML attributes (e.g., `<a href="${escHtml(pr.url)}">`) can still break out of the attribute and introduce Cross-Site Scripting (XSS) vulnerabilities.
**Prevention:** Always use regex replacements or a dedicated library to properly escape all 5 critical characters (`&`, `<`, `>`, `"`, `'`) when user input is used in dynamic HTML, especially inside attributes.
