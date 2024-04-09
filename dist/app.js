import * as dotenv from "dotenv";
import pm2 from "pm2";
import os from "os";
import winston from "winston";
import stripAnsi from "strip-ansi";
import LogstashTransport from "winston-logstash/lib/winston-logstash-latest.js";
import { LogserverTransport } from "winston-logserver-transport";
dotenv.config();
const { LOGSTASH_HOST, LOGSTASH_PORT, SSL_CERT_PATH, SSL_KEY_PATH, USE_LOGSERVER, LOGSERVER_BASEURL, LOGSERVER_API_KEY, } = process.env;
const hostname = os.hostname();
const logger = winston.createLogger();
if (USE_LOGSERVER == "yes")
    logger.add(new LogserverTransport({
        apiBaseUrl: LOGSERVER_BASEURL,
        apiKey: LOGSERVER_API_KEY,
    }));
else {
    logger.add(new LogstashTransport({
        port: LOGSTASH_PORT,
        host: LOGSTASH_HOST,
        ssl_enable: true,
        ssl_key: SSL_KEY_PATH,
        ssl_cert: SSL_CERT_PATH,
        rejectUnauthorized: false, //Does Not Work Without This Apparently
    }));
}
logger.on("warn", (error) => {
    console.log("Winston Failed To Send Logs: " + error);
});
logger.on("error", (error) => {
    console.log("Winston Failed To Send Logs: " + error);
});
pm2.launchBus(function (err, bus) {
    if (err)
        return console.error(err);
    bus.on("log:out", function (log) {
        if (!["PM2-LOGSTASH", "LOGSTASH-SERVER"].includes(log.process.name)) {
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
        if (!["PM2-LOGSTASH", "LOGSTASH-SERVER"].includes(log.process.name)) {
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
