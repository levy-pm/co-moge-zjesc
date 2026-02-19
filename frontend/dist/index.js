const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serwer będzie szukał plików (obrazków, stylów) w tym samym folderze
app.use(express.static(__dirname));

// Każde wejście na stronę ma otwierać index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serwer Node działa na porcie ${port}`);
});