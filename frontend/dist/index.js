const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Używamy path.resolve, aby mieć pewność co do ścieżki
const distPath = path.resolve(__dirname);

app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port);