const test = require("node:test");
const assert = require("node:assert/strict");

const { createNetworkServer, resolveTlsEnabled } = require("./tlsServer");

test("resolveTlsEnabled defaults to true in all environments", () => {
  assert.equal(resolveTlsEnabled({ NODE_ENV: "production" }), true);
  assert.equal(resolveTlsEnabled({ NODE_ENV: "development" }), true);
  assert.equal(resolveTlsEnabled({ NODE_ENV: "test" }), true);
});

test("resolveTlsEnabled explicit flag overrides environment default", () => {
  assert.equal(resolveTlsEnabled({ NODE_ENV: "production", TLS_ENABLED: "false" }), false);
  assert.equal(resolveTlsEnabled({ NODE_ENV: "development", TLS_ENABLED: "true" }), true);
});

test("createNetworkServer returns http server when TLS disabled", async () => {
  const calls = [];
  const app = {
    listen(port) {
      calls.push(port);
      return { close() {} };
    },
  };

  const result = await createNetworkServer({
    app,
    fs: { readFile: async () => Buffer.from("") },
    env: { TLS_ENABLED: "false" },
    port: 4321,
  });

  assert.equal(result.protocol, "http");
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 4321);
});

test("createNetworkServer requires key and cert paths when TLS is enabled", async () => {
  const app = {
    listen() {
      throw new Error("should not use app.listen in tls mode");
    },
  };

  await assert.rejects(
    () =>
      createNetworkServer({
        app,
        fs: { readFile: async () => Buffer.from("") },
        env: { TLS_ENABLED: "true" },
        port: 4000,
      }),
    (error) => error && /TLS_KEY_PATH and TLS_CERT_PATH/.test(error.message),
  );
});

test("createNetworkServer enforces TLS by default in production", async () => {
  const app = {
    listen() {
      throw new Error("should not use app.listen in production default tls mode");
    },
  };

  await assert.rejects(
    () =>
      createNetworkServer({
        app,
        fs: { readFile: async () => Buffer.from("") },
        env: { NODE_ENV: "production" },
        port: 4000,
      }),
    (error) => error && /TLS_KEY_PATH and TLS_CERT_PATH/.test(error.message),
  );
});
