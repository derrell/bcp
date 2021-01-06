qx.Class.define("bcp.server.WebSocket",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    _userWsMap : null,

    /**
     * Create the login and logout routes
     *
     * @param app {Express}
     *   The Express app object
     */
    init(app, bIsHttps, server)
    {
      let             wss;
      const           WebSocket = require("ws");

      this.info("WebSocket: starting");

      // Create the mapping from username to websocket
      this._userWsMap = {};

      // Create the websocket server
      wss = new WebSocket.Server(
        {
          clientTracking : false,
          noServer       : true
        });

      // Listen for upgrade messages
      server.on(
        "upgrade",
        (req, socket, head) =>
        {
          let             session;

          console.log("Parsing session from request...");

          session = bcp.server.Session.getInstance().getSession();
          session(
            req,
            {},
            () =>
            {
console.log("req.sesssion=" + JSON.stringify(req.session));
              // If there's no session or if the user isn't logged in...
              if (! req.session ||
                  ! req.session.authenticated ||
                  ! req.session.username)
              {
                // ... then just destroy the socket. No communication.
                console.log("not authenticated; destroying socket");
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
              }

              console.log("Session is parsed");

              wss.handleUpgrade(
                req,
                socket,
                head,
                (ws) =>
                {
                  wss.emit("connection", ws, req);
                });
            });
        });

      wss.on(
        "connection",
        (ws, req) =>
        {
          const username = req.session.username;
          // Keep track of this user and his websocket
          this._userWsMap[username] = ws;

          // Make clients available anyplace we have app
          app.locals.clients = this._userWsMap;

          console.log(
            `Welcome ${username}. Connected clients: ` +
              `${Object.keys(this._userWsMap).length}`);

          ws.on(
            "message",
            (message) =>
            {
              let             session;

              session = bcp.server.Session.getInstance().getSession();
              session(
                req,
                {},
                () =>
                {
                  // If there's no session or if the user isn't logged in...
                  if (! req.session ||
                      ! req.session.authenticated ||
                      ! req.session.username)
                  {
                    // ... then ignore the message
                    console.log("not authenticated");
                    ws.close();
                    return;
                  }
                });

              console.log(
                `Received message ${message} from user ${username}`);

              ws.send(`Hi ${username}!`);
            });

          ws.on(
            "close",
            () =>
            {
              delete this._userWsMap[username];
            });
        });
    }
  }
});
