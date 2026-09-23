// Vulnerable: Cross-Site Scripting
const express = require('express');
const app = express();

app.get('/greet', (req, res) => {
    const name = req.query.name;
    res.send("<h1>Hello " + name + "</h1>");
});
