qx.Class.define("bcp.server.Server",
{
  extend : qx.application.Basic,

  members :
  {
    main()
    {
      let           app;
      let           portPrimary;
      let           portAlternate;
      let           server;
      let           options;
      let           privateKey;
      let           certificate;
      let           protocol;
      const         fs = require("fs");
      const         http = require("http"); // TODO: remove
      const         https = require("https");
      const         express = require("express");
      const         bodyParser = require("body-parser");
      const         CERTDIR = "/etc/letsencrypt/live/bcp.unwireduniverse.com";
      const         PRIVATE_KEY_FILE = `${CERTDIR}/privkey.pem`;
      const         CERTIFICATE_FILE = `${CERTDIR}/fullchain.pem`;

      qx.log.Logger.register(qx.log.appender.NodeConsole);
      this.debug("Starting up");

      if (qx.core.Environment.get("qx.debug"))
      {
        // In debug mode, we'll use HTTP only
        protocol = http;
        portPrimary = portAlternate = 3000;
      }
      else
      {
        // We'll use HTTPS
        // Read the private key and certificate
        // TODO: specify proper key, cert file names
        protocol = https;
        privateKey = fs.readFileSync(PRIVATE_KEY_FILE);
        certificate = fs.readFileSync(CERTIFICATE_FILE);
        options =
          {
            key  : privateKey,
            cert : certificate
          };

        // We'll listen on both HTTPS for the app and HTTP as redirector
        portPrimary = 3000;
        portAlternate = 3001;
      }
      
      // Create the Express app
      app = express();

      // Create the web server
      if (protocol === https)
      {
        server = https.createServer(options, app);
      }

/*
      app.use(
        (req, res, next) =>
        {
          console.log("Got request for: " + req.path);
          next();
        });
*/

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

/*
      app.use(
        (req, res, next) =>
        {
          console.log("Request body: ", req.body);
          next();
        });
*/

      // Create the session
      new bcp.server.Session(app, protocol === https);

      // Create the routes for logging in, authentication, logging out
      new bcp.server.Auth(app, protocol === https);

      // Create the user interface
      new bcp.server.Gui(app, protocol === https);

      // Create the remote procedure calls
      new bcp.server.Rpc(app, protocol === https);

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

      if (protocol === https)
      {
        // Start the server
        server.listen(
          portPrimary,            // Port designated for HTTPS
          () =>
          {
            this.debug(
              `Listening for HTTPS ` +
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
              let             redirectTo;

              // Redirect to the same location, but use HTTPS instead of HTTP
              redirectTo =
                `https://${req.hostname}:${portPrimary}/index.html`;
              console.log(`Got HTTP request; redirecting to ${redirectTo}`);
              res.redirect(redirectTo);
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
              `Listening for HTTP  on port ${portPrimary}`);
          });
      }
    }
  }
});
