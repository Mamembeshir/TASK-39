const https = require("https");

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function resolveTlsEnabled(env) {
  if (env.TLS_ENABLED !== undefined) {
    return toBoolean(env.TLS_ENABLED);
  }
  return env.NODE_ENV === "production";
}

async function createNetworkServer({ app, fs, env, port }) {
  const tlsEnabled = resolveTlsEnabled(env);
  if (!tlsEnabled) {
    return { protocol: "http", server: app.listen(port) };
  }

  const keyPath = env.TLS_KEY_PATH;
  const certPath = env.TLS_CERT_PATH;
  const caPath = env.TLS_CA_PATH;

  if (!keyPath || !certPath) {
    throw new Error("TLS_ENABLED=true requires TLS_KEY_PATH and TLS_CERT_PATH");
  }

  const [key, cert, ca] = await Promise.all([
    fs.readFile(keyPath),
    fs.readFile(certPath),
    caPath ? fs.readFile(caPath) : Promise.resolve(null),
  ]);

  const options = { key, cert };
  if (ca) {
    options.ca = ca;
  }

  return {
    protocol: "https",
    server: https.createServer(options, app).listen(port),
  };
}

module.exports = {
  createNetworkServer,
  resolveTlsEnabled,
};
