require('dotenv').config();
const { port } = require('./src/config/env');

const app = require('./src/app');

app.listen(port, () => {
  console.log(`DEKANTCE API listening on port ${port}`);
});
