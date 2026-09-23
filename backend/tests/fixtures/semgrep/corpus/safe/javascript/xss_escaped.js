// Safe: Escaped HTML Rendering
const express = require('express');
const escapeHtml = require('escape-html');
const app = express();

app.get('/greet', (req, res) => {
    const name = escapeHtml(req.query.name || '');
    res.send(`<h1>Hello ${name}</h1>`);
});
