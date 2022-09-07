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
qx.Class.define("bcp.server.Auth",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    _db    : null,

    /**
     * Create the login and logout routes
     *
     * @param app {Express}
     *   The Express app object
     */
    init(app)
    {
      const           sqlite3 = require("sqlite3");
      const           { open } = require("sqlite");

      this.info("Auth: starting");

      // Open the database
      open(
        {
          filename : `${process.cwd()}/pantry.db`,
          driver   : sqlite3.Database
        })
        .then(
          (db) =>
          {
            this._db = db;

            return this._db.prepare(
              [
                "PRAGMA foreign_keys = ON;"
              ].join(" "))
              .then(
                (stmt) =>
                {
                  return stmt.all({});
                });
          });

      // Create routes
      [
        this.__routeEnsureLoggedIn,
        this.__routeLogin,
        this.__routeLogout
      ].forEach(
        (f) =>
        {
          f.call(this, app);
        });
    },

   /**
     * Ensure that all requests are authenticated.
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeEnsureLoggedIn(app)
    {
      app.use(
        (req, res, next) =>
        {
          // Are they already logged in?
          if (req.session && req.session.authenticated)
          {
            // Yup. Move on.
            next();
            return;
          }

          // Only allow unauthenticated requests for specific pages and
          // folders
          if (req.path == "/" ||
              req.path == "/index.html" ||
              req.path == "/favicon.ico" ||
              req.path.startsWith("/bcp.client/") ||
              req.path.startsWith("/resource/") ||
              req.path.startsWith("/transpiled/") ||
              req.path == "/login" ||
              req.path == "/logout")
          {
            next();
            return;
          }

          // Tell them to log in
          res.status(403).send("Authentication required");
        });
    },

   /**
     * Allow logging in via /login. Authenticate the user using the provided
     * credentails, and establish a session so they can continue to access
     * functionality for a while without logging in again.
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeLogin(app)
    {
      app.post(
        "/login",
        (req, res) =>
        {
          let             hash;
          let             username;
          let             password;
          let             fs = require("fs");
          let             crypto = require("crypto");

          if (! req.body || ! req.body.username)
          {
            this.debug("/login called without body or username!");
            res.status(401).send("Authentication failed");
            return;
          }

          this.info("/login called: username=" + req.body.username);

          if (req.session.authenticated)
          {
            res.status(200).send("Already authenticated");
            return;
          }

          // Retrieve arguments
          username = req.body.username;
          password = req.body.password;

          // Make sure we got a username and password
          if (! username || ! password)
          {
            this.info("Missing username or password in request");
            res.status(401).send("Authentication failed");
            return;
          }

          // Convert username to lower case (make case-insensitive)
          username = username.toLowerCase();

          // Hash the provided password
          hash =
            crypto
            .createHash("sha256")
            .update(password)
            .digest("hex");

          Promise.resolve()
            .then(
              () =>
              {
                return this._db.prepare(
                    [
                      "SELECT password, permission_level",
                      "  FROM User",
                      "  WHERE username = $username;"
                    ].join(" "));
              })
            .then(
              (stmt) =>
              {
                return stmt.all( { $username : username } );
              })
            .then(
              (result) =>
              {
                // Did we find this username?
                if (result.length < 1)
                {
                  // Nope. Fail authentication
                  this.debug(
                    "User " + username + " not found");
                  res.status(401).send("Authentication failed");
                  return;
                }

                // Does the password match?
                if (result[0].password != hash)
                {
                  // Nope. Fail authentication
                  this.debug(
                    "User " + username + " password didn't match");
                  res.status(401).send("Authentication failed");
                  return;
                }

                // The user authenticates.
                this.info(`Authenticated user ${username}`);
                req.session.authenticated = true;
                req.session.username = username;
                req.session.userId = username + "#" + (new Date()).getTime();
                req.session.permissionLevel = result[0].permission_level;
                res.status(200).send("Authentication successful");
              });
        });
    },

    /**
     * Allow logging out via /logout. The session is reset, and the caller is
     * redirected to the main page.
     *
     * @param app {Express}
     *   The Express app which should route here on /logout
     */
    __routeLogout(app)
    {
      app.get(
        "/logout",
        (req, res) =>
        {
          this.info("/logout called: username=" +
                    req.session.username);

          bcp.server.WebSocket.getInstance().userLogout(req.session);
          delete req.session;
          res.redirect("/");
        });
    }
  }
});
