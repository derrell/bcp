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

          this.rpc("getDeliveryDay", [])
            .then(
              (result) =>
              {
console.log("getUsdaSignature data:", result);
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
          width: 1400
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
      let             checkbox;
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

      // Right-justify the rest
      treeItem.addWidget(new qx.ui.core.Spacer(), { flex: 1 });

      // Add the remaining fields
      o = new qx.ui.basic.Label(`USDA $: ${data.usda$ || "$3"}`);
      o.set(
        {
          width  : 100,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      // On leaves, add a checkbox for indicating whether they're USDA eligible
      checkbox = new qx.ui.form.ToggleButton(
        "Not Eligible", "qxl.dialog.icon.warning");

      checkbox.set(
        {
          focusable   : false,
          value       : !! data.usdaEligible,
          height      : 18,
          width       : 100,
          marginRight : 12,
          paddingTop  : 2
        });
      if (data.usdaEligible)
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

      // When this checkbox is tapped, mark as fulfilled
      checkbox.addListener(
        "tap",
        () =>
        {
          // Create the form for adding/editing a appointment record
          this._usdaForm = new qxl.dialog.Form({});

          if (checkbox.getValue())
          {
            formData =
              {
                signature :
                {
                  type       : "signature",
                  label      : "",
                  value      : "xxx"
                }
              };

            root = this.getRoot();
            rootSize = root.getInnerSize();
            this._usdaForm.set(
              {
                message          : this.bold(
                  "I affirm that my monthly income is no greater than $3."),
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
                  (err, data) =>
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

                    console.log("form result=", result);
                    // this.rpc("saveUsdaSignature", [ result ])
                    //   .catch(
                    //     (e) =>
                    //     {
                    //       console.warn("Error saving changes:", e);
                    //       qxl.dialog.Dialog.error(
                    //         `Error saving changes: ${e}`);
                    //     });
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
                checkbox.setValue(false);
              });
          }
        });

      treeItem.addWidget(checkbox);

      o = new qx.ui.basic.Label(`Family size: ${data.family_size}`);
      o.set(
        {
          width  : 100,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      o = new qx.ui.basic.Label(
        data.pet_types ? `Pets: ${data.pet_types}` : "");
      o.set(
        {
          width  : 150,
          alignY : "middle"
        });
      treeItem.addWidget(o);

      o = new qx.ui.form.TextArea(data.notes ? `Notes: ${data.notes}` : "");
      o.set(
        {
          singleStep        : 5,
          width             : 300,
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

      o = new qx.ui.basic.Image();
      o.set(
        {
          scale  : true,
          width  : 150,
          height : 38,
          source : "data:image/png;base64,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"
        });
      treeItem.addWidget(o);

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
          checkCredentials      : this.loginCheckCredentials,
          callback              : callback,
          showForgotPassword    : false,
          caption               : caption
      });

      loginWidget.addListener(
        "appear",
        () =>
        {
          loginWidget._username.set(
            {
              value   : "PIN",
              enabled : false
            });
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
      if (username === "PIN" && password === "1234")
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
