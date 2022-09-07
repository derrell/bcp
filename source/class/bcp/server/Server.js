/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2022 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
qx.Class.define("bcp.server.Server",
{
  extend : qx.application.Basic,

  members :
  {
    /**
     * @ignore(require)
     */
    main()
    {
      let           p;
      let           app;
      let           argv;
      let           portPrimary;
      let           portAlternate;
      let           server;
      let           protocol;
      let           securityContext = null;
      const         fs = require("fs");
      const         http = require("http"); // TODO: remove
      const         https = require("https");
      const         yargs = require("yargs");
      const         express = require("express");
      const         bodyParser = require("body-parser");
      const         CERTDIR = "/etc/letsencrypt/live/bcp.unwireduniverse.com";
      const         PRIVATE_KEY_FILE = `${CERTDIR}/privkey.pem`;
      const         CERTIFICATE_FILE = `${CERTDIR}/fullchain.pem`;

      qx.log.Logger.register(qx.log.appender.NodeConsole);
      this.debug("Starting up");

      argv = yargs
        .option(
          "test",
          {
            alias       : "t",
            description : "Listen on the test port",
            type        : "boolean"
          })
        .help()
        .alias("help", "h")
        .argv;

      if (argv.test)
      {
        // We're in test mode, which is on the live server, using
        // https, but with a non-standard port.
        protocol = https;
        portPrimary = 4000;
        portAlternate = undefined;
      }
      else if (qx.core.Environment.get("qx.debug"))
      {
        // In debug mode, we'll use HTTP only
        protocol = http;
        portPrimary = 3000;
        portAlternate = undefined;
      }
      else
      {
        // We'll use HTTPS
        protocol = https;

        // We'll listen on both HTTPS for the app and HTTP as redirector
        portPrimary = 3000;
        portAlternate = 3001;
      }
      
      // Create the Express app
      app = express();

      // Create the web server
      if (protocol === https)
      {
        const readCertAndKey = () =>
        {
          let             privateKey;
          let             certificate;
          const           tls = require("tls");

          // Read the current (possibly recently updated) certificate
          // and private key. Generate a security context with them
          // that will be used for subsequent connection requests.
          console.log("Server: reading " +
                      (securityContext == null ? "initial" : "potentially new") +
                      " certificate and key");
          certificate = fs.readFileSync(CERTIFICATE_FILE);
          privateKey = fs.readFileSync(PRIVATE_KEY_FILE);
          securityContext = new tls.createSecureContext(
            {
		      cert : certificate,
		      key  : privateKey,
	        });
        };

        // Read the certificate and key now, for immediate use
        readCertAndKey();

        // Read the certificate and key daily so we always have
        // current ones
        setInterval(readCertAndKey, 1000 * 60 * 60 * 24);

        // Called on each connenction request, and can specify which
        // security context to use. We always use the security context
        // generated from the most recently read certificate and
        // private key.
        const sniCallback = (serverName, callback) =>
        {
	      callback(null, securityContext);
        };

        // Create the server!
        server = https.createServer(
          {
            SNICallback : sniCallback
          },
          app);
      }

/*
      // Uncomment for debugging
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
      // Uncomment for voluminous debugging (includes body)
      app.use(
        (req, res, next) =>
        {
          console.log(`Request path=${req.path} body: `, req.body);
          next();
        });
*/

      // Create the session
      bcp.server.Session.getInstance().init(app, protocol === https);

      // Create the routes for logging in, authentication, logging out
      bcp.server.Auth.getInstance().init(app, protocol === https);

      // Create the user interface
      bcp.server.Gui.getInstance().init(app, protocol === https);

      // Create the remote procedure calls
      bcp.server.Rpc.getInstance().init(app, protocol === https);

      // Create the get-report interface
      bcp.server.GetReport.getInstance().init(app, protocol === https);

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

        if (typeof portAlternate == "number")
        {
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
      }
      else
      {
        server = app.listen(
          portPrimary,
          () =>
          {
            this.debug(
              `Listening for HTTP  on port ${portPrimary}`);
          });
      }

      // Prepare to send/receive messages on websockets... but await
      // the database to be ready
      bcp.server.Rpc.getInstance().getDB()
        .then(
          (db) =>
          {
            bcp.server.WebSocket.getInstance().init(
              app,
              protocol === https,
              server,
              db);
          });
   }
  }
});
