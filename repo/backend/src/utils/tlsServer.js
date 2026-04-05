const https = require("https");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function resolveTlsEnabled(env) {
  if (env.TLS_ENABLED !== undefined) {
    return toBoolean(env.TLS_ENABLED);
  }
  return true;
}

async function createNetworkServer({ app, fs, env, port, execFile: execFileImpl = execFileAsync, createHttpsServer = https.createServer }) {
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

  let key;
  let cert;
  let ca = null;
  try {
    [key, cert, ca] = await Promise.all([
      fs.readFile(keyPath),
      fs.readFile(certPath),
      caPath ? fs.readFile(caPath) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }

    const fallback = await ensureDevTlsMaterial({ fs, execFileImpl });
    [key, cert, ca] = await Promise.all([
      fs.readFile(fallback.keyPath),
      fs.readFile(fallback.certPath),
      caPath ? fs.readFile(caPath).catch(() => null) : Promise.resolve(null),
    ]);
  }

  const options = { key, cert };
  if (ca) {
    options.ca = ca;
  }

  return {
    protocol: "https",
    server: createHttpsServer(options, app).listen(port),
  };
}

async function ensureDevTlsMaterial({ fs, execFileImpl }) {
  const tlsDir = path.join(os.tmpdir(), "homecareops-tls");
  const keyPath = path.join(tlsDir, "localhost.key");
  const certPath = path.join(tlsDir, "localhost.crt");

  await fs.mkdir(tlsDir, { recursive: true });

  try {
    await Promise.all([fs.readFile(keyPath), fs.readFile(certPath)]);
    return { keyPath, certPath };
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  await execFileImpl(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      "365",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-subj",
      "/CN=localhost",
    ],
    { cwd: tlsDir },
  );

  return { keyPath, certPath };
}

module.exports = {
  createNetworkServer,
  resolveTlsEnabled,
};
