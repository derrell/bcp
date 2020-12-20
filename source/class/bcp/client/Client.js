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
    bcp.client.MFulfillment,
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
      let             logo;
      let             header;
      let             font;
      let             label;
      let             butLogin;
      let             butLogout;


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

      butLogout = new qx.ui.form.Button("Logout");
      butLogout.set(
        {
          maxHeight : 28,
          marginTop : 10
        });
      header.add(butLogout);

      //
      // Build the main view
      //

      // Create a tabview for the remainder of the page
      this._tabView = new qx.ui.tabview.TabView();
      mainContainer.add(this._tabView, { flex : 1 });

      // Make sure all of our local form elements are registered
      bcp.client.RegisterFormElements.register();

      // Create each of the tabview pages
      this._createClientListTab(this._tabView);
      this._createFulfillmentTab(this._tabView);
      this._createDistributionTab(this._tabView);
      this._createReportsTab(this._tabView);
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
              console.log("Not authorized");
              this._createLogin();
              return;
            }

            throw e;
          });
    },

    /**
     * Creates a sample login widget
     */
    _createLogin: function()
    {
      let             loginWidget;

      loginWidget = new qxl.dialog.Login(
        {
          image                  : "dialog/logo.gif",
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
