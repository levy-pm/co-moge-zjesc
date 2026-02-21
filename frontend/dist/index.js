const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const distPath = __dirname;

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Frontend serwowany na porcie ${port}`);
});
