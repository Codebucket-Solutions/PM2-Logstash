require("dotenv").config();
const pm2 = require("pm2");
const os = require("os");
const jks = require("jks-js");
const fs = require("fs");
const winston = require("winston");
const LogstashTransport = require("winston-logstash/lib/winston-logstash-latest");

const { JKS_PASSWORD, LOGSTASH_HOST, LOGSTASH_PORT } = process.env;
const hostname = os.hostname();
const keystore = jks.toPem(fs.readFileSync("./jks/keystore.jks"), JKS_PASSWORD);
const { cert, key } = keystore["alias"];

const logger = winston.createLogger({
  transports: [
    new LogstashTransport({
      port: LOGSTASH_PORT,
      host: LOGSTASH_HOST,
      ssl_enable: true,
      ssl_key: key,
      ssl_cert: cert,
    }),
  ],
});

logger.on("error", (error) => {
  // Make the decission in here
  console.log(error);
});

pm2.launchBus(function (err, bus) {
  if (err) return console.error("PM2 Loggly:", err);

  bus.on("log:out", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
      //console.log(log);
      // console.log(log.process.name, log.data);
      // Log to gelf
      var message = {
        timestamp: new Date(log.at).toISOString(),
        version: "1",
        service: "PM2",
        application: log.process.name,
        environment: "output",
        user: hostname,
        message: log.data,
      };
      logger.info(log.data, message);
      //gelf.emit("gelf.log", message);
    }
  });

  bus.on("log:err", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
      //console.log(log);
      // console.error(log.process.name, log.data);
      // Log to gelf
      var message = {
        timestamp: new Date(log.at).toISOString(),
        version: "1",
        service: "PM2",
        application: log.process.name,
        environment: "error",
        user: hostname,
        message: log.data,
      };
      logger.error(log.data, message);
    }
  });

  bus.on("reconnect attempt", function () {
    console.log("PM2: Bus reconnecting");
  });

  bus.on("close", function () {
    pm2.disconnectBus();
  });
});
