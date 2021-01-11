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
    init(app, bIsHttps, server, db)
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
          let             pingTimer;
          const           username = req.session.username;
          const           stampedUsername =
            username + "#" + (new Date()).getTime();

          // Keep track of this user and his websocket
          this._userWsMap[stampedUsername] = ws;

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

          // We'll be pinging the connection periodically to ensure it's alive
          ws.bAlive = true;
          ws.on("pong", () => { ws.bAlive = true; });

          pingTimer = setInterval(
            () =>
            {
              if (! ws.bAlive)
              {
                console.log(`User ${username} has disappeared`);
                ws.terminate();

                // This user has gone away
                delete this._userWsMap[stampedUsername];

                // Let other users know this user was detected gone
                this.sendToAll(
                  {
                    messageType : "users",
                    data        :
                      Object.keys(this._userWsMap)
                      .map(user => user.replace(/#.*/, ""))
                      .sort()
                  });
                return;
              }

              ws.bAlive = false;
              ws.ping(() => {});
            },
            30000);

          // If there's a message of the day, send it
          db.prepare(
            [
              "SELECT value",
              "  FROM KeyValueStore",
              "  WHERE key = 'motd';"
            ].join(" "))
            .then(
              (stmt) =>
              {
                return stmt.all({});
              })
            .then(
              (result) =>
              {
                if (result.length > 0 && result[0].value.trim().length > 0)
                {
                  ws.send(
                    JSON.stringify(
                      {
                        messageType : "motd",
                        data        : result[0].value
                      }));
                }
              })
            .catch((e) =>
              {
                console.warn("Error retrieving motd", e);
              });

          // Let everyone know this user just logged in
          this.sendToAll(
            {
              messageType : "users",
              data        :
                Object.keys(this._userWsMap)
                .map(user => user.replace(/#.*/, ""))
                .sort()
            });

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
              let             user;

              // Stop the ping timer
              clearInterval(pingTimer);

              // This user is disconnected
              delete this._userWsMap[stampedUsername];

              // Let other users know this user has disconnected
              this.sendToAll(
                {
                  messageType : "users",
                  data        :
                    Object.keys(this._userWsMap)
                    .map(user => user.replace(/#.*/, ""))
                    .sort()
                });
            });
        });
    },

    userLogout(sessionData)
    {
      let             user;
      let             username;
      let             { ws } = sessionData;

      // If we don't find the websocket in the session, ...
      if (! ws)
      {
        // ... then search by username
        for (user in this._userWsMap)
        {
          username = user.replace(/#.*/, "");
          if (username == sessionData.username)
          {
            ws = this._userWsMap[user];
            break;
          }
        }
      }

      // If still no websocket, we have nothing to do
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

          // Let other users know this user just logged out
          this.sendToAll(
            {
              messageType : "users",
              data        :
                Object.keys(this._userWsMap)
                .map(user => user.replace(/#.*/, ""))
                .sort()
            });
          break;
        }
      }

      // Whether we found it in our map or not, close the websocket
      ws.close();
    },

    /**
     * Send to all users, with exceptions
     */
    sendToAllWithExceptions(message, exceptWs)
    {
      let             user;
      let             messageString = JSON.stringify(message);

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
        this._userWsMap[user].send(messageString);
      }
    },

    /**
     * Send to all users
     */
    sendToAll(message)
    {
      this.sendToAllWithExceptions(message);
    }
  }
});
