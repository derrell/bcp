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
qx.Class.define("bcp.server.DbDownload",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    _path     : null,
    _dbBackup : null,

    /**
     * Serve the GUI
     *
     * @param app {Express}
     *   The Express app object
     */
    init : function(app)
    {
      const           fs = require("fs");

      this.info("DbDownload: starting");

      this._path =
        qx.core.Environment.select(
          "bcp.target",
          {
            "build"  : "../bcp-db.git",
            "source" : `${process.cwd()}/../bcp-db.git`
          });
      this._dbBackup = `${this._path}/pantry.sql`;

      // Create routes
      [
        this.__routeDbDownload
      ].forEach(
        (f) =>
        {
          f.call(this, app);
        });
    },

    /**
     * Provide the interface for downloading the latest database backup.
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeDbDownload : function(app)
    {
      app.get(
        "/dbDownload",
        (req, res) =>
        {
          let             stats;
          let             filename;
          const           { username, permissionLevel } = req.session;

          console.log("dbDownload");

          // Ensure the user has permission to download the database
          if (typeof req.session.permissionLevel != "number" ||
              req.session.permissionLevel < 60) // same as RPC deleteClient
          {
            console.log(
              `User ${username} does not have permission to download db; ` +
                `user has permission level ${permissionLevel}`);
            res.status(401).send("Authentication failed");
            return;
          }

          // Get the last modification time of the database backup
          try
          {
            const           stats = require("fs").statSync(this._dbBackup);
            const           mtime = stats.mtime;
            const           date = new Date(mtime);
          
            filename =
              "pantry" +
              "-" +
              date.getFullYear() +
              ("0" + (date.getMonth() + 1)).substr(-2) +
              ("0" + date.getDate()).substr(-2) +
              ("0" + date.getHours()).substr(-2) +
              ("0" + date.getMinutes()).substr(-2) +
              ("0" + date.getSeconds()).substr(-2) +
              ".sql";

            res.download(
              this._dbBackup,
              filename,
              (e) =>
              {
                if (e)
                {
                  console.warn(`Could not provide database backup: `, e);
                  return;
                }

                console.log(`Database backup was downloaded by ${username}`);
              });
          }
          catch(e)
          {
            console.log(`dbBackup failed for ${username}:`, e);
            res.status(401).send("Backup not available");            
          }
        });
    }
  }
});
