## 2024-05-25 - Fix XSS Vulnerability in escHtml
**Vulnerability:** XSS vulnerability found in `frontend/app.js`'s `escHtml` function. It used `document.createElement('div').textContent = s; return d.innerHTML;` which does not escape single or double quotes, making it unsafe for use within HTML attributes like `<a href="${escHtml(...)}">`.
**Learning:** Browser-based textContent escaping is insufficient for rendering variables into HTML attributes. It only escapes characters like `<` and `&` but not quotes, which are crucial for breaking out of attribute contexts.
**Prevention:** Always use a robust HTML escaping utility that explicitly replaces `&`, `<`, `>`, `"`, and `'` with their corresponding HTML entities when dynamically building HTML strings.
