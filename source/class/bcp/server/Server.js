qx.Class.define("bcp.server.Server",
{
  extend : qx.application.Basic,

  members :
  {
    main()
    {
      let             app;
      let             portPrimary;
      let             portAlternate;
      let             server;
      let             options;
      let             privateKey;
      let             certificate;
      const           fs = require("fs");
      const           http = require("http"); // TODO: remove
      const           https = require("https");
      const           express = require("express");
      const           bodyParser = require("body-parser");

      // TODO: switch to https
      const           PROTOCOL = http;

      qx.log.Logger.register(qx.log.appender.NodeConsole);
      this.debug("Starting up");

      if (PROTOCOL === https)
      {
        // Read the private key and certificate
        // TODO: specify proper key, cert file names
        privateKey = fs.readFileSync("PRIVATE_KEY_FILE");
        certificate = fs.reqdFileSync("CERTIFICATE_FILE");
        options =
          {
            key  : privateKey,
            cert : certificate
          };

        // We'll listen on both HTTPS and HTTP ports
        portPrimary = 3000;
        portAlternate = 3001;
      }
      else
      {
        portPrimary = portAlternate = 3000;
      }
      
      // Create the Express app
      app = express();

      // Create the web server
      if (PROTOCOL === https)
      {
        server = PROTOCOL.createServer(options);
      }

      app.use(
        (req, res, next) =>
        {
          console.log("Got request for: " + req.path);
          next();
        });

      // our RPC requests have a content-type that looks like
      // "application/x-www-form-urlencoded, application/json" so
      // we need to see if it contains "application/json"
      app.use(bodyParser.json(
        {
          type : (req) =>
          {
            return req.headers["content-type"].includes("application/json");
          }
        }));

      // Also check for url-encoded content
      app.use(bodyParser.urlencoded( { extended : true } ));

      app.use(
        (req, res, next) =>
        {
          console.log("Request body: ", req.body);
          next();
        });

      // Create the session
      new bcp.server.Session(app, PROTOCOL === https);

      // Create the routes for logging in, authentication, logging out
      new bcp.server.Auth(app, PROTOCOL === https);

      // Create the user interface
      new bcp.server.Gui(app, PROTOCOL === https);

      // Create the remote procedure calls
      new bcp.server.Rpc(app, PROTOCOL === https);

      app.use(
        (err, req, res, next) =>
        {
          console.error(err.message);
          next(err);
        });

      // Define what to do if no route is found
      app.use(
        (req, res, next) =>
        {
          this.debug("FAILED REQUEST FOR: " + req.path);
          res.status(404).send("Requested page not found");
        });

      if (PROTOCOL === https)
      {
        // Start the server
        server.listen(
          portPrimary,            // Port designated for HTTPS
          () =>
          {
            const protocol = PROTOCOL === https ? "HTTPS" : "HTTP";
            
            this.debug(
              `Listening for ${protocol} ` +
                `on port ${portPrimary} (primary access)`);
          });

        //
        // Create a redirector: direct HTTP traffic to HTTPS
        //
        app = express();    // a new app specifically for this purpose
        app.get(
          "*",
          (req, res) =>
            {
              // Redirect to the same location, but use HTTPS instead of HTTP
              res.redirect("https://" + req.get("host") + req.originalUrl);
            });
        app.listen(
          portAlternate,        // Port designated for HTTP
          () =>
            {
              this.debug(
                `Listening for HTTP  on port ${portAlternate} (redirector)`);
            });
      }
      else
      {
        app.listen(
          portPrimary,
          () =>
          {
            this.debug(
              `Listening for HTTP  on port ${portPrimary} (redirector)`);
          });
      }
    }
  }
});
