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
    bcp.client.MUsdaSignature,
    bcp.client.MDistribution,
    bcp.client.MReports,
    bcp.client.MAdmin
  ],

  statics :
  {
    RpcError : bcp.server.Rpc.Error
  },

  members :
  {
    _me             : null,
    _tabView        : null,
    _mostRecentMotd : "",
    _greeterPin     : "",

    /**
     * @ignore(WebSocket)
     */
    main()
    {
      let             mainContainer;
      let             rightButtonContainer;
      let             hBox;
      let             logo;
      let             header;
      let             font;
      let             label;
      let             idLabel;
      let             clock;
      let             butLogin;
      let             butLogout;
      let             butMotd;
      let             passwordChange;
      let             messageContainer;
      let             messages;
      let             chatInput;
      let             chatSend;
      let             userListContainer;
      let             userList;
      let             createWebSocket;
      let             ws;
      const           identity =
            "Billerica Community Pantry<br>Management Console";

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

      // Spread out the title
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      idLabel = new qx.ui.basic.Label(
        location.port == 3000
          ? identity
          : `${identity}<br>(Test Server)`);
      idLabel.set(
        {
          paddingTop : 20,
          font       : "header",
          rich       : true,
          textAlign  : "center",
          textColor  : location.port == 3000 ? "black" : "red"
        });
      header.add(idLabel);

      // Spread out the message box
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      // place the chat list and chat input vertically
      messageContainer =
        new qx.ui.container.Composite(new qx.ui.layout.VBox(0));
      messageContainer.exclude();  // hidden during login
      header.add(messageContainer);

      // Add the chat messages list
      messages = new qx.ui.form.List();
      messages.set(
        {
          marginTop  : 20,
          height     : 80,
          width      : 500
        });
      messageContainer.add(messages);

      messages.addListener(
        "changeSelection",
        () =>
        {
          messages.resetSelection();
        });

      // Label the chat input box
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      hBox.set(
        {
          width : 500
        });
      messageContainer.add(hBox);

      // Add the chat input
      label = new qx.ui.basic.Label("Chat:");
      label.set(
        {
          alignY : "middle",
          font   : "bold"
        });
      hBox.add(label);
      chatInput = new qx.ui.form.TextField();
      chatInput.set(
        {
          value : ""
        });
      hBox.add(chatInput, { flex : 1  });

      // Add the chat send button
      chatSend = new qx.ui.form.Button("Send");
      chatSend.set(
        {
          command : new qx.ui.command.Command("Enter")
        });
      hBox.add(chatSend);

      chatSend.addListener(
        "execute",
        () =>
        {
          let             input = chatInput.getValue().trim();

          // Clear the chat box
          chatInput.setValue("");

          // If there's no text, don't do anyting
          if (input.length === 0)
          {
            return;
          }

          // Issue a request to send this chat message
          this.rpc("sendChat", [ input ]);
        });
      hBox.add(chatSend);

      header.add(new qx.ui.core.Spacer(12, 12));

      // Create a vbox for the label and user list
      userListContainer =
        new qx.ui.container.Composite(new qx.ui.layout.VBox());
      userListContainer.exclude();
      header.add(userListContainer);

      // Add the label
      label = new qx.ui.basic.Label("Online");
      label.set(
        {
          font : "bold",
          margin : 0,
          padding : 0
        });
      userListContainer.add(label);

      // Add the user list
      userList = new qx.ui.form.List();
      userList.set(
        {
          marginTop  : -1,
          height     : 110,
          width      : 90
        });
      userListContainer.add(userList);

      userList.addListener(
        "changeSelection",
        () =>
        {
          userList.resetSelection();
        });

      // Right-justify the buttons
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      // Display the buttons vertically
      rightButtonContainer =
        new qx.ui.container.Composite(new qx.ui.layout.VBox());
      header.add(rightButtonContainer);

      passwordChange = new qx.ui.basic.Label("");
      passwordChange.set(
        {
          rich       : true,
          textAlign  : "center",
          allowGrowX : true
        });
      rightButtonContainer.add(passwordChange);
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
          maxHeight  : 28,
          marginTop  : 0,
          visibility : "excluded"
        });
      rightButtonContainer.add(butLogout);

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

      clock = new qx.ui.basic.Label("");
      clock.set(
        {
          rich       : true,
          visibility : "excluded" // clock is only shown to Greeter user
        });
      clock.exclude();
      rightButtonContainer.add(clock);

      butMotd = new qx.ui.form.Button("MOTD");
      butMotd.set(
        {
          maxHeight  : 28,
          marginTop  : 2,
          visibility : "excluded"
        });
      rightButtonContainer.add(butMotd);
      butMotd.addListener("execute", this._buildMotdForm, this);

      //
      // Build the main view
      //

      // Create a tabview for the remainder of the page
      this._tabView = new qx.ui.tabview.TabView();
      mainContainer.add(this._tabView, { flex : 1 });

      // When the active tab is changed, send an I'm Alive message
      this._tabView.addListener(
        "changeSelection",
        () =>
        {
          this.rpc("alive", []);
        });

      // Make sure all of our local form elements are registered
      bcp.client.RegisterFormElements.register();

      createWebSocket =
        () =>
        {
          let           url;

          // If a prior websocket open was attempted, close it
          ws && ws.close();

          // Create a websocket for async communication with the server
          url =
            [
              location.protocol == "https:" ? "wss" : "ws",
              "://",
              location.hostname,
              ":",
              location.port
            ].join("");
          ws = new WebSocket(url);

          ws.addEventListener(
            "open",
            () =>
            {
              console.log("Websocket connected");
            });

          ws.addEventListener(
            "message",
            (e) =>
            {
              let             text;
              let             color;
              let             children;
              let             listItem;
              let             wsMessage = JSON.parse(e.data);

              if (! ("messageType" in wsMessage))
              {
                return;
              }

              switch(wsMessage.messageType)
              {
              case "users" :
                userList.removeAll();
                wsMessage.data.forEach(
                  (userInfo) =>
                  {
                    let           text;
                    const         { name, isIdle } = userInfo;

                    // If user is idle, gray their name in the user list
                    if (isIdle)
                    {
                      text =
                        [
                          "<span style='color: gray; font-style: italic;'>",
                          name,
                          "</span>"
                        ].join("");
                    }
                    else
                    {
                      text = name;
                    }

                    listItem = new qx.ui.form.ListItem(text);
                    listItem.set(
                      {
                        rich      : true,
                        padding   : 0,
                        decorator : "message-item"
                      });
                    userList.add(listItem);
                  });
                break;

              case "config" :
                // Save this most recent greeter PIN
                this._greeterPin = wsMessage.data.greeterPin;

                // fall through

              case "motd" :
                // Save this most recent message of the day and greeter PIN
                this._mostRecentMotd = wsMessage.data.motd;

                // Set color of message of the day
                color = "red";
                text =
                  [
                    `<span style='color: ${color}; font-weight: bold;'>`,
                    qx.bom.String.escape(wsMessage?.data?.motd || ""),
                    "</span>"
                  ].join("");
                listItem = new qx.ui.form.ListItem(text);
                listItem.set(
                  {
                    rich      : true,
                    height    : 14,
                    padding   : 0,
                    decorator : "message-item"
                  });
                messages.add(listItem);
                messages.scrollChildIntoView(listItem, null, null, true);
                break;

              case "message" :
                text =
                  [
                    "<span style='font-style: italic;'>",
                    wsMessage.data.from,
                    "</span>",
                    ": ",
                    qx.bom.String.escape(wsMessage.data.message),
                  ].join("");
                listItem = new qx.ui.form.ListItem(text);
                listItem.set(
                  {
                    rich      : true,
                    height    : 14,
                    padding   : 0,
                    decorator : "message-item"
                  });
                messages.add(listItem);
                messages.scrollChildIntoView(listItem, null, null, true);

                // Prune the message list to keep it from ever-expanding
                for (children = messages.getChildrenContainer()._getChildren();
                     children.length > 100;
                     children = messages.getChildrenContainer()._getChildren())
                {
                  messages.remove(children[0]);
                }
                break;

              case "clientArrived" :
                {
                  let { distribution, familyName } = wsMessage.data;
                  let topic = `clientArrived/${distribution}/${familyName}`;
                  qx.event.message.Bus.dispatchByName(topic, wsMessage.data);
                }
                break;

              case "clientAncillary" :
                {
                  let { distribution, familyName } = wsMessage.data;
                  let topic = `clientAncillary/${distribution}/${familyName}`;
                  qx.event.message.Bus.dispatchByName(topic, wsMessage.data);
                }
                break;

              case "appointmentFulfilled" :
                {
                  let { distribution, familyName } = wsMessage.data;
                  let topic =
                      `appointmentFulfilled/${distribution}/${familyName}`;
                  qx.event.message.Bus.dispatchByName(topic, wsMessage.data);
                }
                break;
              }
            });

          ws.addEventListener(
            "close",
            () =>
            {
              ws = null;
              setTimeout(() => location.reload(), 3000);
            });
        };

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

            // Save information about ourself
            this._me = me;

            // Make the chat area and user list visible now if
            // permission level is greater than 40; they, and logout
            // button and password change hidden if permission level is
            // not greater than 40.
            if (me.permissionLevel > 40)
            {
              messageContainer.show();
              userListContainer.show();
            }
            else
            {
              passwordChange.exclude();
              butMotd.exclude();

              // Reduce the application identity padding to save space
              idLabel.setPaddingTop(0);

              // Show the clock
              clock.show();
              setInterval(
                () =>
                {
                  let             now = new Date();
                  let             hours = now.getHours() % 12 || 12;

                  clock.setValue(
                    "<span style='font-weight: bold;'>" +
                    ("0" + hours).substr(-2) +
                    ":" +
                    ("0" + now.getMinutes()).substr(-2) +
                    ":" +
                    ("0" + now.getSeconds()).substr(-2) +
                    "</span>");
                },
                1000);
            }

            // Regardless, the logout button needs to be shown
            butLogout.show();

            // Create the websocket now
            createWebSocket();

            // Show the logged-in user
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
                requiredPermission : 50,
                implementation     : this._createDeliveryDayTab
              },
              {
                requiredPermission : 40,
                implementation     : this._createUsdaSignatureTab
              },
              {
                requiredPermission : 50,
                implementation     : this._createDistributionTab
              },
              {
                requiredPermission : 50,
                implementation     : this._createReportsTab
              },
              {
                requiredPermission : 60,
                implementation     : this._createAdminTab
              }
            ].forEach(
              (pageInfo) =>
              {
                if (me.permissionLevel >= pageInfo.requiredPermission)
                {
                  pageInfo.implementation.bind(this)(this._tabView, me);
                }
              });

            // Show the MOTD button if permission allows
            if (me.permissionLevel >= 70)
            {
              butMotd.show();
            }
          });
    },

    close()
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
    bold(s)
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
    underlineChar(s, n = 0)
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
     * Convert a 24-hour time to its 12-hour equivalent. Handle null, "" input
     * too.
     *
     * @param input {String|null}
     *   A 24-hour time string, in format HH:MM with optional leading
     *   or trailing text; or an empty string or null
     *
     * @return {String}
     *   The 24-hour time converted to a 12-hour time with am/pm suffix if a
     *   valid 24-hour time was provided; an empty string, otherwise.
     */
    convert24to12(input)
    {
      let             time12;
      let             time24;
      let             ret;

      if (input === null ||
          (typeof input == "string" && input.length === 0))
      {
        return "";
      }

      // Extract the 24-hour time string. There may be prefix
      time24 = input.replace(/^.*([0-9][0-9]:[0-9][0-9]).*$/, "$1");

      if (time24 === null ||
          (typeof time24 == "string" && time24.length === 0))
      {
        return "";
      }

      time12 = time24.toString().split(":");

      // If no time, just leave blank
      if (time12.length === 0)
      {
        return "";
      }

      if (time12[0] == 0)
      {
        // Midnight becomes 12am
        time12[0] += 12;
        time12 = time12.join(":") + " am";
      }
      else if (time12[0] < 12)
      {
        // Other times before noon remain as is, with an "am" suffix
        time12 = time24 + " am";
      }
      else if (time12[0] == 12)
      {
        // Noon becomes 12pm
        time12 = time24 + " pm";
      }
      else
      {
        // Times after noon are converted to 12-hour format and get "pm" suffix
        time12[0] -= 12;
        time12 = time12.join(":") + " pm";
      }

      ret = input.replace(/^(.*)([0-9][0-9]:[0-9][0-9])(.*)/,
                          `$1${time12}$3`);
      return ret;
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
     *   Promise that resolves with the RPC result.
     */
    rpc(functionName, args)
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
    _createLogin()
    {
      let             loginWidget;

      loginWidget = new qxl.dialog.Login(
        {
          text                   : "Login",
          checkCredentials       : this.checkCredentials,
          callback               : this.finalCallback.bind(this),
          allowCancel            : false,
          cancelOnEscape         : false,
          showForgotPassword     : false
      });

      loginWidget.show();
    },

    /**
     * Create and process the Message Of The Day form
     */
    _buildMotdForm()
    {
      let             p;
      let             form;
      let             formData;
      const           _this = this;

      formData =
        {
          motd:
          {
            type       : "TextField",
            label      : "New MOTD",
            value      : this._mostRecentMotd,
            properties :
            {
              width      : 400
            }
          }
        };

      form = new qxl.dialog.Form(
      {
        caption    : "Message Of The Day",
        context    : this
      });

      form.set(
        {
//          labelColumnWidth : 150,
          formData         : formData,
        });
      form._okButton.set(
        {
          label   : "Save"
        });
      form.show();


      // Focus the first field upon appear
      form.addListener(
        "appear",
        () =>
        {
          form._formElements["motd"].focus();
        },
        this);

      p = form.promise();

      p.then(
        (formValues) =>
        {
          // Cancelled?
          if (! formValues)
          {
            // Yup. Nothing to do
            return;
          }

          console.log("formValues=", formValues);

          this.rpc("saveMotd", [ formValues ])
            .then(
              (result) =>
              {
                console.log(`saveClient result: ${result}`);

                // A result means something failed.
                if (result)
                {
                  qxl.dialog.Dialog.error(result);
                  return;
                }
              })
            .catch(
              (e) =>
              {
                console.warn("Error saving changes:", e);
                qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
              });
        });
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
    checkCredentials(username, password, callback)
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
    finalCallback(e, data)
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
