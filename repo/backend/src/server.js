const { startServer } = require("./app");

startServer().catch((error) => {
  console.error(`Unable to start API: ${error.message}`);
  process.exit(1);
});
