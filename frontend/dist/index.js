const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serwuj pliki statyczne z folderu dist (tu gdzie jest ten plik)
app.use(express.static(__dirname));

// Każde zapytanie kieruj do index.html (obsługa React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serwer działa na porcie ${port}`);
});