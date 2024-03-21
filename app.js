const pm2 = require("pm2");
const os = require("os");
const hostname = os.hostname();

pm2.launchBus(function (err, bus) {
  if (err) return console.error("PM2 Loggly:", err);

  bus.on("log:out", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
        console.log(log.data)
      // console.log(log.process.name, log.data);
      // Log to gelf
      var message = {
        timestamp: log.at / 1000,
        version: log.process.version,
        service: "PM2",
        application: log.process.name,
        environment: "env",
        user: hostname,
        message: log.data,
      };
      console.log(message);
      //gelf.emit("gelf.log", message);
    }
  });

  bus.on("log:err", function (log) {
    if (log.process.name !== "PM2-LOGSTASH") {
      
        console.log(log.data)
        // console.error(log.process.name, log.data);
      // Log to gelf
      var message = {
        timestamp: log.at / 1000,
        version: log.process.version,
        service: "PM2",
        application: log.process.name,
        environment: "env",
        user: hostname,
        message: log.data,
      };
      console.log(message);
    }
  });

  bus.on("reconnect attempt", function () {
    console.log("PM2: Bus reconnecting");
  });

  bus.on("close", function () {
    pm2.disconnectBus();
  });
});
