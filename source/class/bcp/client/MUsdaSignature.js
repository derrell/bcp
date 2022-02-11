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
qx.Mixin.define("bcp.client.MUsdaSignature",
{
  statics :
  {
    _appointmentRowColor    :
    [
      "table-row-background-odd", // first appointment of a new time
      "table-row-background-even"
    ]
  },

  members :
  {
    _nextSigAppointmentRowColor : 0,
    _tabLabelUsdaSignature      : null,

    /**
     * Create the delivery day page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createUsdaSignatureTab(tabView)
    {
      let             page;
      let             button;
      let             command;

      // Create this tab
      this._tabLabelUsdaSignature = this.underlineChar("USDA Signature", 5);

      page = new qx.ui.tabview.Page(this._tabLabelUsdaSignature);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+S");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));


      // Retrieve the USDA Signature information when the page appears
      page.addListener(
        "appear",
        () =>
        {
          page.removeAll();

          this.rpc("getUsdaSignature", [])
            .then(
              (result) =>
              {
                if (! result || result.appointments.length === 0)
                {
                  qxl.dialog.Dialog.alert("No appointments scheduled");
                  return;
                }

                this._buildUsdaSignatureTree(page, result);
              })
            .catch(
              (e) =>
              {
                console.warn("getUsdaSignature:", e);
                qxl.dialog.Dialog.alert(
                  "Could not retrieve USDA Signature information: " +
                  e.message);
              });
        });
    },

    _buildUsdaSignatureTree : function(page, deliveryInfo)
    {
      let             vBox;
      let             tree;
      let             scroller;
      let             container;
      let             root;
      let             nodes = {};
      const           { distribution, appointments } = deliveryInfo;

      scroller = new qx.ui.container.Scroll();
      container = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      container.setAllowGrowX(false);
      container.setAllowStretchX(false);
      scroller.add(container);
      page.add(scroller, { flex : 1 });

      tree = new qx.ui.tree.Tree().set(
        {
          width: 950
        });
      tree.addListener(
        "changeSelection",
        () =>
        {
          tree.resetSelection();
        });
      container.add(tree, { flex : 1 });

      root = this.configureSigTreeItem(
        new qx.ui.tree.TreeFolder(),
        "Distribution start date: " + distribution);
      root.setOpen(true);
      tree.setRoot(root);

      appointments.forEach(
        (appointment, i) =>
        {
          let             node;
          let             parent;
          let             label;
          const           day = appointment.appt_day;
          const           time = appointment.appt_time;
          const           Branch = qx.ui.tree.TreeFolder;
          const           Leaf = qx.ui.tree.TreeFile;

          // If this appointment is already fulfilled, ...
          if (appointment.fulfilled)
          {
            // ... then exclude this item
            return;
          }

          // Have we not yet created a node for this day?
          if (! nodes[day])
          {
            // We haven't. Create it.
            label =
              appointment.method == "Delivery"
              ? "Delivery"
              : `Day ${day} (${appointment.appt_date})`;
            nodes[day] = this.configureSigTreeItem(new Branch(), label);
            root.add(nodes[day]);

            // If this is a delivery, we'll attach the leaf node here.
            if (appointment.method == "Delivery")
            {
              parent = nodes[day];
            }

            // Open day and delivery nodes
            nodes[day].setOpen(true);
          }

          // If we don't yet have a parent...
          if (! parent)
          {
            // Have we not yet created a node for this time?
            if (! nodes[day][time])
            {
              // We haven't. Create it.
              nodes[day][time] =
                this.configureSigTreeItem(
                  new Branch(),
                  this.convert24to12(time));
              nodes[day].add(nodes[day][time]);
            }

            // Open time nodes
            nodes[day][time].setOpen(true);

            // Get the parent to which we'll attach this appointment
            parent = nodes[day][time];
          }

          // Create this apppointment
          node = this.configureSigTreeItem(
            new Leaf(), appointment, distribution);
          parent.add(node);
        });
    },

    configureSigTreeItem : function(treeItem, data, distribution)
    {
      let             o;
      let             text;
      let             checkbox;
      let             signature;
      let             formData;
      let             root;
      let             rootSize;
      let             fUsdaSigResizeForm;
      let             fUsdaFormHandler;
      const           MUsdaSignature = bcp.client.MUsdaSignature;

      // We don't want any icons on branches or leaves
      treeItem.set(
        {
          icon    : null,
          height  : 40,
          alignY  : "middle"
        });

      // Add an open/close button to any branch
      if (treeItem instanceof qx.ui.tree.TreeFolder)
      {
        treeItem.addOpenButton();
      }
      // Add the label. Branches are given strings; leaves, appointment map.
      treeItem.addLabel(typeof data == "string" ? data : data.family_name);

      // There's no additional information on branches
      if (treeItem instanceof qx.ui.tree.TreeFolder)
      {
        // Reset the first color for this new time so all first colors
        // are consistent.
        this._nextSigAppointmentRowColor = 0;

        // All done here, for a branch.
        return treeItem;
      }

      // Set the width of the label
      treeItem.getChildControl("label").set(
        {
          maxWidth : 156,
          minWidth : 156,
          width    : 156
        });

      // Right-justify the rest
      treeItem.addWidget(new qx.ui.core.Spacer(), { flex: 1 });

      // Add the remaining fields
      data.id = ("00" + data.id).substr(-3);
      o = new qx.ui.basic.Label(`#${data.id}`);
      o.set(
        {
          width  : 70,
          alignX : "right",
          alignY : "middle",
          font   : qx.bom.Font.fromString("bold 16px Arial")
        });
      treeItem.addWidget(o);

      o = new qx.ui.basic.Label(`USDA:<br>${data.usda_amount}`);
      o.set(
        {
          rich   : true,
          width  : 50,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      // On leaves, add a checkbox for indicating whether they're USDA eligible
      checkbox = new qx.ui.form.ToggleButton(
        "Not Eligible", "qxl.dialog.icon.warning");

      checkbox.set(
        {
          focusable   : false,
          value       : !! data.usda_eligible_signature,
          height      : 18,
          width       : 100,
          marginRight : 12,
          paddingTop  : 2
        });
      if (!! data.usda_eligible_signature)
      {
        checkbox.setIcon("qxl.dialog.icon.ok");
        checkbox.setLabel("Eligible");
      }

      // Keep the button label synchronized with the button's state
      checkbox.addListener(
        "changeValue",
        () =>
        {
          if (! checkbox.getValue())
          {
            checkbox.setIcon("qxl.dialog.icon.warning");
            checkbox.setLabel("Not Eligible");
          }
          else
          {
            checkbox.setIcon("qxl.dialog.icon.ok");
            checkbox.setLabel("Eligible");
          }
        });

      // When this checkbox is tapped, obtain a signature
      checkbox.addListener(
        "tap",
        () =>
        {
          // Create the form for obtaining a signature
          this._usdaForm = new qxl.dialog.Form(
            {
              afterButtonsFunction : function(buttonBar, form)
              {
                let             butClear;

                // Center the Save and Cancel buttons (but right-justify Clear)
                buttonBar.addAt(new qx.ui.core.Spacer(100), 0);
                buttonBar.addAt(new qx.ui.core.Spacer(), 1, { flex: 1 });

                // Create the Clear button
                butClear = new qx.ui.form.Button("Clear");
                butClear.setWidth(100);

                butClear.addListener(
                  "execute",
                  () =>
                  {
                    // Clear the signature
                    form._formElements["signature"].clear();
                  });

                // Right-justify the Clear button
                buttonBar.add(new qx.ui.core.Spacer(), { flex: 1 });
                buttonBar.add(butClear);
              }
            });

          // If eligibility changed to false...
          if (! checkbox.getValue())
          {
            this.rpc(
              "updateUsdaSignature",
              [
                distribution,
                data.family_name,
                null
              ])
              .then(
                () =>
                {
                  // remove the signature from the tree
                  signature.setSource(null);
                })
              .catch(
                (e) =>
                {
                  console.warn("Error saving changes:", e);
                  qxl.dialog.Dialog.error(
                    `Error saving changes: ${e}`);
                });

            // Nothing more to do in this case
            return;
          }

          // Eligibility changed to true. Obtain a signature.
          formData =
            {
              signature :
              {
                type       : "signature",
                label      : "",
                value      : ""
              }
            };

          root = this.getRoot();
          rootSize = root.getInnerSize();
          this._usdaForm.set(
            {
              message          : this.bold(
                "I affirm that my monthly income is no greater than " +
                  data.usda_amount +
                  "."),
              labelColumnWidth : 150,
              formData         : formData,
              width            : rootSize.width,
              height           : rootSize.height,
            });

          fUsdaSigResizeForm =
            (e) =>
            {
              let             data = e.getData();

              this._usdaForm.set(
                {
                  width           : data.width,
                  height          : data.height
                });
            };

          // If the window resizes (or orientation changes), resize
          // the form to fill the available space.
          root.addListener("resize", fUsdaSigResizeForm);

          // Stop trying to resize the form when the form closes
          [ "ok", "cancel" ].forEach(
            (event) =>
            {
              this._usdaForm.addListenerOnce(
                event,
                () =>
                {
                  root.removeListener("resize", fUsdaSigResizeForm);
                });
            });

          this._usdaForm._message.setFont(
            qx.bom.Font.fromString("bold 30px Arial"));

          this._usdaForm._okButton.set(
            {
              rich    : true,
              label   : this.underlineChar("Save"),
              command : new qx.ui.command.Command("Alt+S")
            });

          this._usdaForm.center();
          this._usdaForm.show();

          // Don't use the callback mechanism as we might need to
          // submit the form multiple times if the PIN entry fails
          // of if the greeter decides the signature is incomplete
          // or unusable. Instead, we'll await the "ok" and "cancel"
          // events.
          fUsdaFormHandler =
            (result) =>
            {
              // Reshow the signature until PIN is accepted
              this._usdaForm.show();

              // Prompt for the password that allows returning to
              // the secure environment
              this.createLogin(
                "Accept signature",
                (err, username) =>
                {
                  // Was the password accepted?
                  if (err)
                  {
                    // Nope. Let them re-enter it
                    return;
                  }

                  // PIN was accepted. We can now hide the form.
                  this._usdaForm.hide();

                  // If the form was cancelled...
                  if (! result)
                  {
                    // ... then we're done
                    return;
                  }

                  this.rpc(
                    "updateUsdaSignature",
                    [
                      distribution,
                      data.family_name,
                      result.signature
                    ])
                    .then(
                      () =>
                      {
                        // Add the signature to the tree
                        signature.setSource(result.signature);
                      })
                    .catch(
                      (e) =>
                      {
                        console.warn("Error saving changes:", e);
                        qxl.dialog.Dialog.error(
                          `Error saving changes: ${e}`);
                      });
                });
            };

          // Handle "Ok", retrieving signature form results
          this._usdaForm.addListener(
            "ok",
            () =>
            {
              let             result;

              // Get the signature form result
              result =
                qx.util.Serializer.toNativeObject(this._usdaForm.getModel());

              fUsdaFormHandler(result);
            });

          // Handle "Cancel". Indicate it with null vs. results.
          this._usdaForm.addListener(
            "cancel",
            () =>
            {
              fUsdaFormHandler(null);
              checkbox.setValue(! checkbox.getValue()); // revert indicator
            });
        });

      treeItem.addWidget(checkbox);

      o = new qx.ui.basic.Label(`Family size:<br>${data.family_size}`);
      o.set(
        {
          rich   : true,
          width  : 70,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      text = qx.bom.String.escape(
        data.pet_types ? `${data.pet_types}` : "");
      o = new qx.ui.basic.Label(text ? `Pets:<br>${text}` : "");
      o.set(
        {
          rich   : true,
          width  : 78,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      o = new qx.ui.form.TextArea(data.notes ? `Notes: ${data.notes}` : "");
      o.set(
        {
          singleStep        : 5,
          width             : 160,
          alignY            : "middle",
          readOnly          : true,
          appearance        : "label"
        });
      o.addListener(
        "appear",
        () =>
        {
          o.getContentElement().setStyles( { "line-height": 1 } );
        });
      treeItem.addWidget(o);

      signature = new qx.ui.basic.Image();
      signature.set(
        {
          scale  : true,
          width  : 150,
          height : 38,
          source : data.usda_eligible_signature
        });
      treeItem.addWidget(signature);

      // Set the row's background color
      treeItem.setBackgroundColor(
        MUsdaSignature._appointmentRowColor[this._nextSigAppointmentRowColor]);
      this._nextSigAppointmentRowColor =
        (this._nextSigAppointmentRowColor + 1) % 2;

      return treeItem;
    },

    /**
     * Creates a login widget for continuing after client signature
     * @param caption
     * @param button
     */
    createLogin : function(caption, callback)
    {
      let             loginWidget;

      loginWidget = new qxl.dialog.Login(
        {
          text                  : "Please provide PIN to continue",
          checkCredentials      : this.loginCheckCredentials.bind(this),
          callback              : callback,
          showForgotPassword    : false,
          caption               : caption
      });

      // User need not enter the name, only the actual PIN
      loginWidget._username.set(
        {
          value   : "PIN",
          enabled : false
        });

      // Password is a PIN (numeric). Show only number keypad on mobile device
      loginWidget._password.getContentElement().setAttribute("type", "number");

      loginWidget.addListener(
        "appear",
        () =>
        {
          // Focus the password field
          loginWidget._password.focus();
        });

      loginWidget.show();
    },

    /**
     * Asyncronous function for checking credentials. It takes the
     * username, password and a callback function as parameters. After
     * performing the authentication, the callback is called with the
     * result, which should be undefined or null if successful, and
     * the error message if the authentication failed. If the problem
     * was not the authentication, but some other exception, you could
     * pass an error object.
     *
     * @param username {String}
     * @param password {String}
     * @param callback {Function}
     *   The callback function that needs to be called with
     *   (err, data) as arguments
     */
    loginCheckCredentials : function(username, password, callback)
    {
      if (username === "PIN" && password === this._greeterPin)
      {
        callback(null, username);
      }
      else
      {
        callback("Wrong PIN");
      }
    }
  }
});
