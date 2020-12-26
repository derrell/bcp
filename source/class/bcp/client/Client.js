/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

/**
 * @asset(bcp/client/*)
 */
qx.Class.define("bcp.client.Client",
{
  extend  : qx.application.Standalone,
  include :
  [
    bcp.client.MClientMgmt,
    bcp.client.MAppointment,
    bcp.client.MDeliveryDay,
    bcp.client.MDistribution,
    bcp.client.MReports
  ],

  statics :
  {
    RpcError : bcp.server.Rpc.Error
  },

  members :
  {
    _tabView  : null,

    main()
    {
      let             mainContainer;
      let             vBox;
      let             logo;
      let             header;
      let             font;
      let             label;
      let             butLogin;
      let             butLogout;
      let             passwordChange;

      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug"))
      {
        qx.log.appender.Native = qx.log.appender.Native;
        qx.log.appender.Console = qx.log.appender.Console;
      }

      // Create the main container that covers the whole page
      mainContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.getRoot().add(mainContainer, { edge : 2 });

      //
      // Build the header
      //

      // Create the header hbox
      header = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      mainContainer.add(header);

      // Add the logo, scaling it to a reasonable size
      logo = new qx.ui.basic.Image("bcp/client/logo.png");
      logo.set(
        {
          width        : 80,
          height       : 80,
          scale        : true,
          allowShrinkX : true,
          allowShrinkY : true
        });
      header.add(logo);

      // Center the title
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      label = new qx.ui.basic.Label(
        "Billerica Community Pantry<br>Management Console");
      label.set(
        {
          paddingTop : 20,
          font       : "header",
          rich       : true,
          textAlign  : "center"
        });
      header.add(label);

      // Right-justify the buttons
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      // Display the buttons vertically
      vBox = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      header.add(vBox);

      passwordChange = new qx.ui.basic.Label("");
      passwordChange.set(
        {
          rich       : true,
          textAlign  : "center",
          allowGrowX : true
        });
      vBox.add(passwordChange);
      passwordChange.addListener(
        "tap",
        () =>
        {
          qxl.dialog.Dialog.alert(
            "To change your password, speak with Derrell");
        });

      butLogout = new qx.ui.form.Button("Logout");
      butLogout.set(
        {
          maxHeight : 28,
          marginTop : 10
        });
      vBox.add(butLogout);

      butLogout.addListener(
        "execute",
        () =>
        {
          let             xhr = new qx.io.request.Xhr();

          xhr.set(
            {
              url         : "/logout",
              method      : "GET",
            });

          xhr.addListenerOnce("success", () => location.reload());
          xhr.addListenerOnce("fail", e => location.reload());

          xhr.send();
        });

      //
      // Build the main view
      //

      // Create a tabview for the remainder of the page
      this._tabView = new qx.ui.tabview.TabView();
      mainContainer.add(this._tabView, { flex : 1 });

      // Make sure all of our local form elements are registered
      bcp.client.RegisterFormElements.register();

      this.rpc("whoAmI", [])
        .then(
          (me) =>
          {
            console.log("me:", me);

            // No result if authentication failed (handled by this.rpc())
            if (! me)
            {
              return;
            }

            passwordChange.setValue(
              "<span style='text-decoration: underline;'>" +
                this.bold(me.username) +
              "</span>");

            // Create each of the tabview pages
            [
              {
                requiredPermission : 50,
                implementation     : this._createClientListTab
              },
              {
                requiredPermission : 50,
                implementation     : this._createAppointmentTab
              },
              {
                requiredPermission : 30,
                implementation     : this._createDeliveryDayTab
              },
              {
                requiredPermission : 50,
                implementation     : this._createDistributionTab
              },
              {
                requiredPermission : 50,
                implementation     : this._createReportsTab
              },
            ].forEach(
              (pageInfo) =>
              {
                if (me.permissionLevel >= pageInfo.requiredPermission)
                {
                  pageInfo.implementation.bind(this)(this._tabView);
                }
              });
          });
    },

    close : function()
    {
      this.base(arguments);

      // If the report window is open...
      if (this._reportWin)
      {
        // ... then close it
        this._reportWin.close();
        this._reportWin = null;
      }
    },

    /**
     * Convert the given text to an HTML span with font-weight: bold
     *
     * @param s {String}
     *   The string to be bolded
     */
    bold : function bold(s)
    {
      return (
        [
          "<span style='font-weight: bold;'>",
          s,
          "</span>"
        ].join(""));
    },

    /**
     * Convert the given text to an HTML span with text-decoration: underline
     * for the nth character
     *
     * @param s {String}
     *   The string to have a character underlined
     *
     * @param n {Number}
     *   Which character (0-relative) is to be underlined
     *
     * @return {String}
     *   The original string with a single character underlined
     */
    underlineChar : function bold(s, n = 0)
    {
      let             result = [];

      // Split the string into its constituent characters
      s = s.split("");

      // Add the part of the string that precedes the nth character
      while (n > 0)
      {
        result.push(s.shift());
        --n;
      }

      // Underline the current character
      result.push.apply(
        result,
        [
          "<span style='text-decoration: underline'>",
          s.shift(),
          "</span>"
        ]);

      // Add the remainder of the string
      result.push(s.join(""));

      // Give 'em the whole thing, put back together
      return result.join("");
    },
    /**
     * Issue a Remote Procedure Call
     *
     * The RPC always goes to url /rpc, and the specified function is called
     * with the specified arguments.
     *
     * If the request results in an authentication failure, the login popup is
     * presented.
     *
     * @param functionName {String}
     *   The name of the remote procedure
     *
     * @param args {Array}
     *   Array of arguments to the function
     *
     * @return {Promise}
     *   Promise that resolves with the RPC result. */
    rpc : function(functionName, args)
    {
      let             client;

      client = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      return client.sendRequest(functionName, args)
        .catch(
          (e) =>
          {
            // Is this an authentication or authorization failure?
            if (e.code == 7 && e.message.includes(": 403:"))
            {
              // Yup. Present the login form.
              console.log("Not authorized");
              this._createLogin();
              return;
            }

            // It's not an error we handle. Rethrow for user to handle it.
            throw e;
          });
    },

    /**
     * Creates the login widget
     */
    _createLogin: function()
    {
      let             loginWidget;

      loginWidget = new qxl.dialog.Login(
        {
          text                   : "Login",
          checkCredentials       : this.checkCredentials,
          callback               : this.finalCallback.bind(this),
          showForgotPassword     : false
      });

      loginWidget.show();
    },

    /**
     * Check credentials. The callback is called with the result,
     * which should be undefined or null if successful, and the error
     * message if the authentication failed. If the problem was not
     * the authentication, but some other exception, you could pass an
     * error object.
     *
     * @param username {String}
     *   The entered username
     *
     * @param password {String}
     *   The entered pasword
     *
     * @param callback {Function}
     *   The callback function that needs to be called with (err, data)
     *   as arguments
     */
    checkCredentials: function(username, password, callback)
    {
      let             xhr = new qx.io.request.Xhr();

      xhr.set(
        {
          url         : "/login",
          method      : "POST",
          requestData : { username, password }
        });

      xhr.addListener("success", () => callback(null));
      xhr.addListenerOnce("fail", e => callback("Login failed"));

      xhr.send();
    },

    /**
     * Show failure alert if authentication failed
     *
     * @param err {String|Error|undefined|null}
     * @param data
     */
    finalCallback: function(e, data)
    {
      if (e)
      {
        qxl.dialog.Dialog.alert(e)
          .set({ caption: "Login Error" });
      }
      else
      {
        // Reload the page now that we're logged in
        location.reload();
      }
    }
  }
});
