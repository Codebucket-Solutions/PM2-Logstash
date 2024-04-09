import * as dotenv from "dotenv";
import pm2 from "pm2";
import os from "os";
import winston from "winston";
import stripAnsi from "strip-ansi";
//import LogstashTransport from "winston-logstash/lib/winston-logstash-latest.js";
import { LogserverTransport } from "winston-logserver-transport";
dotenv.config();
const { LOGSTASH_HOST, LOGSTASH_PORT, SSL_CERT_PATH, SSL_KEY_PATH } = process.env;
const hostname = os.hostname();
const logger = winston.createLogger();
logger.add(new LogserverTransport({
    apiBaseUrl: process.env.LOGSERVER_BASEURL,
    apiKey: process.env.LOGSERVER_API_KEY,
}));
logger.on("error", (error) => {
    console.log(error);
});
pm2.launchBus(function (err, bus) {
    if (err)
        return console.error(err);
    bus.on("log:out", function (log) {
        if (log.process.name !== "PM2-LOGSTASH") {
            log.data = stripAnsi(log.data); // Removing Ansi Color Codes
            //Some times errors are logged in normal output
            let errorFlag = log.data.toUpperCase().indexOf("ERROR") != -1;
            if (!(log.data.startsWith("/") || log.data.startsWith("GET"))) {
                //Skipping GET Call Logs (Remove If Needed)
                var message = {
                    timestamp: new Date(log.at).toISOString(),
                    version: "1",
                    service: "PM2",
                    application: log.process.name,
                    environment: errorFlag ? "error" : "output",
                    logLevel: errorFlag ? "error" : "info",
                    host: hostname,
                    message: log.data,
                };
                logger.info(message);
            }
        }
    });
    bus.on("log:err", function (log) {
        if (log.process.name !== "PM2-LOGSTASH") {
            log.data = stripAnsi(log.data); // Removing Ansi Color Codes
            var message = {
                timestamp: new Date(log.at).toISOString(),
                version: "1",
                service: "PM2",
                application: log.process.name,
                environment: "error",
                logLevel: "error",
                host: hostname,
                message: log.data,
            };
            logger.error(message);
        }
    });
    bus.on("reconnect attempt", function () {
        console.log("PM2: Bus reconnecting");
    });
    bus.on("close", function () {
        pm2.disconnect();
    });
});
