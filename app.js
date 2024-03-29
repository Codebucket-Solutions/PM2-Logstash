require("dotenv").config();
const pm2 = require("pm2");
const os = require("os");
const jks = require("jks-js");
const fs = require("fs");
const winston = require("winston");
const stripAnsi = require("fix-esm").require("strip-ansi").default;
const LogstashTransport = require("winston-logstash/lib/winston-logstash-latest");

const { JKS_PASSWORD, LOGSTASH_HOST, LOGSTASH_PORT, KEYSTORE_ALIAS } =
  process.env;
const hostname = os.hostname();
const keystore = jks.toPem(fs.readFileSync("./jks/keystore.jks"), JKS_PASSWORD);
const { cert, key } = keystore[KEYSTORE_ALIAS];

const logger = winston.createLogger();

logger.add(
  new LogstashTransport({
    port: LOGSTASH_PORT,
    host: LOGSTASH_HOST,
    ssl_enable: true,
    ssl_key_content: key,
    ssl_cert_content: cert,
    // formatted: false,
    // trailingLineFeed: true,
  })
);

logger.on("error", (error) => {
  // Make the decission in here
  console.log(error);
});

pm2.launchBus(function (err, bus) {
  if (err) return console.error("PM2 Loggly:", err);

  bus.on("log:out", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
      log.data = stripAnsi(log.data);
      let errorFlag = log.data.toUpperCase().indexOf("ERROR") != -1;
      if (!(log.data.startsWith("/") || log.data.startsWith("GET"))) {
        var message = {
          timestamp: new Date(log.at).toISOString(),
          version: "1",
          service: "PM2",
          application: log.process.name,
          environment: errorFlag ? "error" : "output",
          level: errorFlag ? "error" : "info",
          user: hostname,
          message: log.data,
        };
        logger.info(message);
      }
    }
  });

  bus.on("log:err", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
      log.data = stripAnsi(log.data);
      if (!(log.data.startsWith("/") || log.data.startsWith("GET"))) {
        var message = {
          timestamp: new Date(log.at).toISOString(),
          version: "1",
          service: "PM2",
          application: log.process.name,
          environment: "error",
          level: "error",
          user: hostname,
          message: log.data,
        };
        logger.error(message);
      }
    }
  });

  bus.on("reconnect attempt", function () {
    console.log("PM2: Bus reconnecting");
  });

  bus.on("close", function () {
    pm2.disconnectBus();
  });
});
