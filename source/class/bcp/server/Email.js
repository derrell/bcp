/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2021 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

qx.Class.define("bcp.server.Email",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    /** promisified sendmail function */
    _sendMail : null,

    /** sender and authenticator user name */
    _username : null,

    /**
     * Provide email sending capability to the app
     *
     * @param app {Express}
     *   The Express app object
     */
    init(app, bIsHttps, server, db)
    {
      let             mailer;
      let             username;
      let             password;
      const           nodemailer = require("nodemailer");

      // Retrieve the email authentication username and password
      return Promise.resolve()
        .then(
          () =>
          {
            return db.prepare(
              [
                "SELECT value",
                "  FROM KeyValueStore",
                "  WHERE key = 'email_auth_user';"
              ].join(" "));
          })
        .then((stmt) => stmt.all({}))
        .then((result) => username = result[0].value)
        .then(
          () =>
          {
            return db.prepare(
              [
                "SELECT value",
                "  FROM KeyValueStore",
                "  WHERE key = 'email_auth_password';"
              ].join(" "));
          })
        .then((stmt) => stmt.all({}))
        .then((result) => password = result[0].value)
        .then(
          () =>
          {
            // Create the email transport
            mailer = nodemailer.createTransport(
              {
                service : "gmail",
                auth    :
                {
                  user    : username,
                  pass    : password
                }
              });

            // Promisify the mailer's sendmail method
            this._sendMail =
              require("util").promisify(mailer.sendMail).bind(mailer);
          })
        .catch((e) =>
          {
            console.warn("Error retrieving motd", e);
          });
    },

    async sendEmail(to, subject, body, bHtml, callback)
    {
      let             mailOptions;

      mailOptions =
        {
          from    : this._username,
          to      : to,
          subject : subject,
        };
      if (bHtml)
      {
        mailOptions.html = body;
      }
      else
      {
        mailOptions.text = body;
      }

      return this._sendMail(mailOptions)
        .then(
          (info) =>
          {
            console.log(`Email sent: ${info.response}`);
            if (callback)
            {
              callback(null);
            }
          })
        .catch(
          (e) =>
          {
            console.warn("EMAIL ERROR:", e);

            bcp.server.WebSocket.getInstance().sendToAll(
              {
                messageType : "error",
                data        : `EMAIL ERROR sending to ${to}: ${e}`
              });

            callback(e);
          });
    }
  }
});
