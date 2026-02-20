const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.resolve(__dirname);

// 1. NAJPIERW PROXY: Wszystko co idzie na /api, leci do Django
app.use('/api', createProxyMiddleware({ 
    target: 'http://127.0.0.1:8000', // Upewnij się, że Django faktycznie słucha na tym porcie
    changeOrigin: true,
}));

// 2. POTEM PLIKI STATYCZNE: Obsługa obrazków, CSS, JS
app.use(express.static(distPath));

// 3. NA KOŃCU REACT: Każdy inny adres oddaje index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serwer Node.js działa na porcie ${port}`);
});