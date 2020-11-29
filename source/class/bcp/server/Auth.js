qx.Class.define("bcp.server.Auth",
{
  extend : qx.core.Object,

  /**
   * Create the login and logout routes
   *
   * @param app {Express}
   *   The Express app object
   */
  construct(app)
  {
    this.base(arguments);

    this.info("Auth: starting");

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

  members :
  {
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
console.log("__routeEnsureLoggedIn");
          // Are they already logged in?
          if (req.bcpSession && req.bcpSession.authenticated)
          {
            // Yup. Move on.
            next();
            return;
          }

console.log("Not logged in. Checking for allowed unauthenticated");
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
console.log("Allowed");
            return;
          }

// TODO: REMOVE THIS CODE
console.log("ALLOWING DISALLOWED METHOD !!!!!");
next();
return;

          // Tell them to log in
console.log("Disallowed");
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

          if (req.bcpSession.authenticated)
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

          // Hash the provided password
          hash =
            crypto
            .createHash("sha256")
            .update(password)
            .digest("hex");

/* TODO
          // Does the hash match what's in the database?
          if (hash != users[username].passwordHash)
          {
            this.debug(
              "User " + username + " failed authentication");
            res.status(401).send("Authentication failed");
            return;
          }
*/

          // TODO: do proper authentication
          if (username != "bcp" || password != process.env["BCP_PASSWORD"])
          {
            this.debug(`User ${username} failed authentication`);
            res.status(401).send("Authentication failed");
            return;
          }

          // The user authenticates.
          this.info(`Authenticated user ${username}`);
          req.bcpSession.authenticated = true;
          req.bcpSession.username = username;
          res.status(200).send("Authentication successful");
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
                    req.bcpSession.username);

          req.bcpSession.reset();
          res.redirect("/");
        });
    }
  }
});
