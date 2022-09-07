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
qx.Class.define("bcp.server.WebSocket",
{
  type   : "singleton",
  extend : qx.core.Object,

  statics :
  {
    /** Number of ms since last seen, to be considered idle */
    IDLE_TIME_MS : 60000
  },

  members :
  {
    _userWsMap : null,

    /**
     * Create the login and logout routes
     *
     * @param app {Express}
     *   The Express app object
     *
     * @ignore(require)
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
          let             userTimer;
          let             pingTimer;
          let             greeterPin = "321";
          const           now = (new Date()).getTime();
          const           { userId, username } = req.session;
          const           stampedUsername = username + "#" + now;

          // Keep track of this user and his websocket
          this._userWsMap[stampedUsername] =
            {
              userId   : userId,
              ws       : ws,
              lastSeen : now
            };

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

          // Periodically resend the user list (with idle changes)
          userTimer = setInterval(
            () =>
            {
              this.sendUserList();
            },
            10000);

          // Periodically check for loss of connection on websocket
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
                this.sendUserList();
                return;
              }

              ws.bAlive = false;
              ws.ping(() => {});
            },
            30000);

          // If there's a message of the day, send it
          Promise.resolve()
            .then(
              () =>
              {
                return db.prepare(
                  [
                    "SELECT value",
                    "  FROM KeyValueStore",
                    "  WHERE key = 'greeterPin';"
                  ].join(" "));
              })
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
                  greeterPin = result[0].value.trim();
                }
              })
            .then(
              () =>
              {
                return db.prepare(
                  [
                    "SELECT value",
                    "  FROM KeyValueStore",
                    "  WHERE key = 'motd';"
                  ].join(" "));
              })
            .then(
              (stmt) =>
              {
                return stmt.all({});
              })
            .then(
              (result) =>
              {
                let             motd;

                if (result.length > 0 && result[0].value.trim().length > 0)
                {
                  motd = result[0].value.trim();
                }

                // If either motd or greeterPin is available, send config msg
                if (motd || greeterPin)
                {
                  ws.send(
                    JSON.stringify(
                      {
                        messageType : "config",
                        data        : { motd, greeterPin }
                      }));
                }
              })
            .catch((e) =>
              {
                console.warn("Error retrieving motd", e);
              });

          // Let everyone know this user just logged in
          this.sendUserList();

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

              // Stop the timers
              clearInterval(pingTimer);
              clearInterval(userTimer);

              // This user is disconnected
              delete this._userWsMap[stampedUsername];

              // Let other users know this user has disconnected
              this.sendUserList();
            });
        });
    },

    /**
     * Update the last seen time for a user
     */
    userActive(sessionData)
    {
      let             user;
      const           { userId } = sessionData;

      for (user in this._userWsMap)
      {
        if (this._userWsMap[user].userId == userId)
        {
          this._userWsMap[user].lastSeen = (new Date()).getTime();
          this.sendUserList();
          break;
        }
      }
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
            ws = this._userWsMap[user].ws;
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
        if (this._userWsMap[user].ws == ws)
        {
          delete this._userWsMap[user];

          // Let other users know this user just logged out
          this.sendUserList();
          break;
        }
      }

      // Whether we found it in our map or not, close the websocket
      ws.close();
    },

    /**
     * Send the user list to all users
     */
    sendUserList()
    {
      let           user;
      let           data = [];
      let           timeSinceActive;
      const         now = (new Date()).getTime();

      // For each user...
      for (user in this._userWsMap)
      {
        // ... add a map with the user name and whether their idle or not
        timeSinceActive = now - this._userWsMap[user].lastSeen;
        data.push(
          {
            name   : user.replace(/#.*/, ""),
            isIdle : timeSinceActive > this.constructor.IDLE_TIME_MS
          });
      }

      // Sort by name
      data =
        data.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

      this.sendToAll(
        {
          messageType : "users",
          data        : data
        });
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
        if (exceptWs.includes(this._userWsMap[user].ws))
        {
          // Yup. Don't send to this user
          continue;
        }

        // Send the message to this user
        this._userWsMap[user].ws.send(messageString);
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
