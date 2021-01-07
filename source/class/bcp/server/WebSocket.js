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
          let             users;
          let             session;
          const           username = req.session.username;

          // Keep track of this user and his websocket
          this._userWsMap[username + "#" + (new Date()).getTime()] = ws;

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

              // Save the user's websocket in the session
              req.session.ws = ws;
            });

          console.log(
            `Welcome ${username}. Connected clients: ` +
              `${JSON.stringify(Object.keys(this._userWsMap))}`);

          // Let newly-logged in user who's logged in
          users =
            Object.keys(this._userWsMap)
            .map(user => user.replace(/#.*/, ""))
            .filter((user) => user != username)
            .join(", ");
          if (users)
          {
            users = `Also working now: ${users}`;
          }
          else
          {
            users = "You are the only user at present.";
          }
          ws.send(
            JSON.stringify(
              {
                messageType : "message",
                data        : `Hi ${username}! ${users}`
              }));

          // Let other users know this user just logged in
          this.sendToAllWithExceptions(
            {
              messageType : "message",
              data         : `${username} is now working too`
            },
            ws);

          ws.on(
            "message",
            (message) =>
            {
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
            });

          ws.on(
            "close",
            () =>
            {
              delete this._userWsMap[username];
            });
        });
    },

    userLogout(sessionData)
    {
      let             user;
      const           { ws } = sessionData;

      // If no websocket, we have nothing to do
      if (! ws)
      {
        console.warn(
          `User ${sessionData.username} logged out, without websocket`);
        return;
      }

      // Find the user who has logged out
      for (user in this._userWsMap)
      {
        if (this._userWsMap[user] == ws)
        {
          delete this._userWsMap[user];
          break;
        }
      }

      // Whether we found it in our map or not, close the websocket
      ws.close();
    },

    /**
     * Send to all users, with exceptions
     */
    sendToAllWithExceptions(data, exceptWs)
    {
      let             user;

      // Make exceptions into an array, if not already one
      exceptWs = exceptWs || [];
      if (! Array.isArray(exceptWs))
      {
        exceptWs = [ exceptWs ];
      }

      // Send the data to all users (except possibly one)
      for (user in this._userWsMap)
      {
        // Were we asked not to send to this one?
        if (exceptWs.includes(this._userWsMap[user]))
        {
          // Yup. Don't send to this user
          continue;
        }

        // Send the message to this user
        this._userWsMap[user].send(JSON.stringify(data));
      }
    }
  }
});
