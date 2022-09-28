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
qx.Mixin.define("bcp.client.MUsdaSignature",
{
  statics :
  {
    __USE_PIN_SECURITY      : true,

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
    _loginWidget                : null,

    /**
     * Create the delivery day page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createUsdaSignatureTab(tabView, me)
    {
      let             page;
      let             button;
      let             command;

      // Create this tab
      this._tabLabelUsdaSignature = this.underlineChar("Greeter", 0);

      page = new qx.ui.tabview.Page(this._tabLabelUsdaSignature);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");

      // Exclude the button if permission level is low (only
      // displaying this one tab)
      if (me.permissionLevel <= 40)
      {
        button.exclude();
      }
      else
      {
        // Otherwise, set button rich so it can show shortcut
        button.setRich(true);
      }

      command = new qx.ui.command.Command("Alt+G");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));


      // Retrieve the USDA Signature information when the page appears
      page.addListener(
        "appear",
        () =>
        {
          const buildUsdaSignatureTree =
                () =>
                {
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
                };

          page.removeAll();

          if (bcp.client.MUsdaSignature.__USE_PIN_SECURITY &&
              me.permissionLevel <= 40)
          {
            // Prompt for the PIN before showing the client list
            this.createLogin(
              "Accept",
              (err, username) =>
              {
                // Was the password accepted?
                if (err)
                {
                  // Nope. Let them re-enter it
                  return;
                }

                buildUsdaSignatureTree();
              });
          }
          else
          {
            // No need for PIN as it's not a greeter station
            buildUsdaSignatureTree();
          }
        });
    },

    _buildUsdaSignatureTree : function(page, deliveryInfo)
    {
      let             vBox;
      let             tree;
      let             scroller;
      let             container;
      let             root;
      let             today;
      let             nodes = {};
      const           { distribution, appointments } = deliveryInfo;

      // Get today's date in the same format as a distribution appointment date
      today = new Date();
      today =
        today.getFullYear() + "-" +
        ("0" + (today.getMonth() + 1)).substr(-2) + "-" +
        ("0" + today.getDate()).substr(-2);

      scroller = new qx.ui.container.Scroll();
      container = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      container.setAllowGrowX(false);
      container.setAllowStretchX(false);
      scroller.add(container);
      page.add(scroller, { flex : 1 });

      tree = new qx.ui.tree.Tree().set(
        {
          width      : 1000
        });
      tree.addListener(
        "changeSelection",
        () =>
        {
          tree.resetSelection();
        });
      container.add(tree, { flex : 1 });

      root = this.configureSigTreeItem(
        new bcp.client.widget.TreeFolder(),
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
          const           Branch = bcp.client.widget.TreeFolder;
          const           Leaf = qx.ui.tree.TreeFile;

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

            // Open only today's appointments
            nodes[day].setOpen(appointment.appt_date == today);
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
      let             label;
      let             topic;
      let             arrived;
      let             checkbox;
      let             fulfilled;
      let             signature;
      let             sigStatement;
      let             formData;
      let             root;
      let             rootSize;
      let             fUsdaSigResizeForm;
      let             fUsdaFormHandler;
      let             hidden = [];
      const           MUsdaSignature = bcp.client.MUsdaSignature;
      const           _this = this;

      // We don't want any icons on branches or leaves
      treeItem.set(
        {
          icon    : null,
          height  : treeItem instanceof bcp.client.widget.TreeFolder ? 40 : 70,
          alignY  : "middle"
        });

      // Add an open/close button to any branch
      if (treeItem instanceof bcp.client.widget.TreeFolder)
      {
        treeItem.addOpenButton();
      }
      // Add the label. Branches are given strings; leaves, appointment map.
      if (typeof data == "string")
      {
        treeItem.addLabel(data);
      }
      else
      {
        label = treeItem.getChildControl("label");
        label.setRich(true);
        if (! data.verified)
        {
          label.setTextColor("red");
        }
        text = qx.bom.String.escape(data.family_name);
        treeItem.addLabel(
          text + (data.verified ? "" : "<br>RESIDENCY UNVERIFIED"));
      }

      // There's no additional information on branches
      if (treeItem instanceof bcp.client.widget.TreeFolder)
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

      // Add the button for indicating the client has arrived
      arrived = new qx.ui.form.Button("Arrived", null);
      arrived.set(
        {
          height      : 18,
          width       : 60,
          minWidth    : 60
        });
      arrived.addListener(
        "execute",
        () =>
        {
          this.rpc(
            "updateClientArrival",
            [
              distribution,
              data.family_name,
              true
            ])
          .then(
            () =>
            {
              arrived.exclude();
              hidden.forEach((widget) => widget.show());
            })
          .catch(
            (e) =>
            {
              console.warn("updateClientArrival:", e);
              qxl.dialog.Dialog.alert(
                "Could not update client arrival status for " +
                  `${data.family_name}: ${e.message}`);
            });
        });
      (data.arrival_time || data.fulfilled) && arrived.exclude();
      treeItem.addWidget(arrived);

      // Right-justify the rest
//      treeItem.addWidget(new qx.ui.core.Spacer(), { flex: 1 });

      // Add the remaining fields
      data.id = ("00" + data.id).substr(-3);
      o = new qx.ui.basic.Label(`#${data.id}`);
      o.set(
        {
          width  : 50,
          alignX : "right",
          alignY : "middle",
          font   : qx.bom.Font.fromString("bold 16px Arial")
        });
      ! data.arrival_time && ! data.fulfilled && o.hide();
      hidden.push(o);
      treeItem.addWidget(o);

      o = new qx.ui.basic.Label(`USDA:<br>${data.usda_amount}`);
      o.set(
        {
          rich   : true,
          width  : 50,
          alignY : "middle"
        });
      ! data.arrival_time && ! data.fulfilled && o.hide();
      hidden.push(o);
      treeItem.addWidget(o);

      // On leaves, add a checkbox for indicating whether they're USDA eligible
      checkbox = new qx.ui.form.ToggleButton("Sign", null);

      checkbox.set(
        {
          focusable   : false,
          height      : 18,
          width       : 100,
          marginRight : 12,
          paddingTop  : 2,
          triState    : true,
          value       : null
        });

      // Keep the button label synchronized with the button's state
      checkbox.addListener(
        "changeValue",
        (e) =>
        {
          if (checkbox.getValue() === null)
          {
            checkbox.setIcon(null);
            checkbox.setLabel("Sign");
          }
          else if (! checkbox.getValue())
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

      // If set to ineligible (indicated by zero-length signature),
      // set button state to Not Eligible. If there's already a
      // signature, set button state to Eligible
      if (typeof data.usda_eligible_signature == "string" &&
          data.usda_eligible_signature.length === 0)
      {
        checkbox.setValue(false);
      }
      else if (typeof data.usda_eligible_signature == "string")
      {
        checkbox.setValue(true);
      }

      // If there is a manual override, show it and prevent changes
      switch (data.usda_eligible_next_distro)
      {
      case "yes" :
      case "no" :
        checkbox.set(
          {
            icon    : null,
            label   : "No sig req'd",
            enabled : false
          });
        break;

      default :
        break;
      }


      // If we need to reset the value on form cancellation, track its
      // prior value
      checkbox.setUserData("priorValue", checkbox.getValue());

      // When this checkbox is tapped, obtain a signature
      checkbox.addListener(
        "tap",
        () =>
        {
          let             priorValue = checkbox.getUserData("priorValue");
          let             value = checkbox.getValue();
          let             _this = this;

          // Update the prior value with the current value
          checkbox.setUserData("priorValue", value);

          // Create the form for obtaining a signature
          this._usdaForm = new qxl.dialog.Form(
            {
              afterButtonsFunction : function(buttonBar, form)
              {
                let             butClear;
                let             butNotEligible;
                let             butPaperSignature;

                // Add the Not Eligible button
                butNotEligible = new qx.ui.form.Button(
                  "Not Eligible", "qxl.dialog.icon.warning");
                butNotEligible.set(
                  {
                    minWidth : 140
                  });
                buttonBar.add(butNotEligible);

                butNotEligible.addListener(
                  "execute",
                  () =>
                  {
                    // List items are in order 0=Eligible, 1=Not Eligible
                    let listItems = form._formElements["eligible"]._getItems();

                    // Set to not eligible
                    form._formElements["eligible"].setSelection(
                      [ listItems[1] ]);

                    // Clear the signature
                    form._formElements["signature"].clear();

                    // Submit the form
                    form._okButton.execute();
                  });

                butPaperSignature =
                  new qx.ui.form.Button(_this.tr("Paper Signature"));
                butPaperSignature.set(
                  {
                    minWidth : 140
                  });
                buttonBar.add(butPaperSignature);

                butPaperSignature.addListener(
                  "execute",
                  ()  =>
                  {
                    let             canvas;
                    let             context;
                    const           sigFormField =
                          form._formElements["signature"];

                    // Clear the signature
                    sigFormField.clear();

                    // Get the canvas element and write "On file" to
                    // it, to indicate that the client has signed on
                    // paper
                    canvas = sigFormField.getCanvas();
                    context = canvas.getContext("2d");
                    context.font = "bold 100px Arial";
                    context.fillText("On file", 10, 100);

                    // Convert the "On file" text to a data URL, for
                    // saving as signature
                    sigFormField.setValue(canvas.toDataURL("image/png"));

                    // Submit the form
                    form._okButton.execute();
                  });

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

                [
                  form._okButton,
                  form._cancelButton,
                  butNotEligible,
                  butClear
                ].forEach(
                  (button) =>
                  {
                    button.set(
                      {
                        height : 50,
                        width  : 100
                      });
                  });
              }
            });

          // If eligibility changed to false, we'll set it back to null (Sign)
          if (value === false)
          {
            Promise.resolve()
              .then(
                () =>
                {
                  let             confirm;
                  const           message =
                      "Are you sure you want to switch back to " +
                      "'Sign' and discard the signature?";

                  confirm = new qxl.dialog.Confirm({ message });

                  // Make the confirm box easily usable on a phone/tablet
                  confirm.set(
                    {
                      width : 500
                    });
                  confirm._yesButton.set(
                    {
                      width  : 100,
                      height : 50
                    });
                  confirm._noButton.set(
                    {
                      width  : 100,
                      height : 50
                    });

                  return confirm.show().promise();
                })
              .then(
                (result) =>
                {
                  // If cancelled, don't do anything
                  if (! result)
                  {
                    checkbox.setValue(priorValue); // restore back to Eligible
                    checkbox.setUserData("priorValue", priorValue);
                    return false;
                  }

                  return Promise.resolve()
                    .then(
                      () =>
                      {
                        return this.rpc(
                          "updateUsdaSignature",
                          [
                            distribution,
                            data.family_name,
                            null
                          ]);
                      })
                    .then(() =>
                      {
                        return true;
                      });
                })
              .then(
                (bUpdateSignature) =>
                {
                  if (! bUpdateSignature)
                  {
                    return;
                  }

                  // remove the signature from the tree
                  signature.setSource(null);

                  // Set the button back to Sign
                  checkbox.setValue(null);
                  checkbox.setUserData("priorValue", null);
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
              },

              eligible :
              {
                type  : "SelectBox",
                label : "",
                value : 1,
                options :
                [
                  { 'label' : "Eligible",     "value" : 1 },
                  { 'label' : "Not Eligible", "value" : 0 }
                ],
                properties :
                {
                  // manipulated by "Not Eligible" button in button bar
                  visibility : "excluded"
                }
              }
            };

          // Determine today's date
          let dateString = () =>
            {
              let             now = new Date();
              const           months =
                    [
                      this.tr("January"),
                      this.tr("February"),
                      this.tr("March"),
                      this.tr("April"),
                      this.tr("May"),
                      this.tr("June"),
                      this.tr("July"),
                      this.tr("August"),
                      this.tr("September"),
                      this.tr("October"),
                      this.tr("November"),
                      this.tr("December")
                    ];
              return [
                now.getDate(),
                months[now.getMonth()],
                now.getFullYear()
              ].join(" ");
            };

          // Generate the statement they'll be signing
          sigStatement =
            this.tr("Family Name") + ": " + data.family_name +
            " " +
            "(#" + data.id + ")" +
            "<br>" +
            this.tr("Total Family Size") + ": " + data.family_size_count +
            "<br>&nbsp;&nbsp;" +
            "<span style='display: inline-block; width: 2in;'>" +
            this.tr("Seniors") + ": " +
            "</span>" +
            data.family_count_senior +
            "<br>&nbsp;&nbsp;" +
            "<span style='display: inline-block; width: 2in;'>" +
            this.tr("Adults") + ": " +
            "</span>" +
            data.family_count_adult +
            "<br>&nbsp;&nbsp;" +
            "<span style='display: inline-block; width: 2in;'>" +
            this.tr("Children") + ": " +
            "</span>" +
            data.family_count_child +
            "<p>" +
            this.tr(
              "I declare that as of today, %1, this information is " +
                "correct, and that my family's combined monthly income is " +
                "at or below %2.",
              dateString(),
              data.usda_amount) +
            "</p>";

          root = this.getRoot();
          rootSize = root.getInnerSize();
          this._usdaForm.set(
            {
              message          : (
                this.bold(sigStatement) +
                  "<p>" +
                  this.tr("Please sign in the gray box below") + ":"),
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
            qx.bom.Font.fromString("35px Arial"));

          this._usdaForm._okButton.set(
            {
              label    : this.tr("Save"),
              font     : qx.bom.Font.fromString("bold 24px Arial"),
              minWidth : 140
            });

          this._usdaForm._cancelButton.set(
            {
              label    : this.tr("Cancel"),
              minWidth : 140
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
              let             saveSignature =
                () =>
                {
                  // We can now hide the form.
                  this._usdaForm.hide();

                  // If the form was cancelled...
                  if (! result)
                  {
                    // ... then we're done
                    return;
                  }

                  // If they said Not Eligible, set signature to 0-length
                  if (! result.eligible)
                  {
                    result.signature = "";
                  }

                  this.rpc(
                    "updateUsdaSignature",
                    [
                      distribution,
                      data.family_name,
                      result.signature,
                      result.signature ? sigStatement : ""
                    ])
                    .then(
                      () =>
                      {
                        const         bEligible = result.signature.length > 0;

                        // Add the signature to the tree
                        signature.setSource(
                          bEligible ? result.signature : null);

                        // Set checkbox to Eligible
                        checkbox.setValue(bEligible);
                        checkbox.setUserData("priorValue", bEligible);
                      })
                    .catch(
                      (e) =>
                      {
                        console.warn("Error saving changes:", e);
                        qxl.dialog.Dialog.error(
                          `Error saving changes: ${e}`);
                      });
                };

              // Reshow the signature until PIN is accepted
              this._usdaForm.show();

              if (bcp.client.MUsdaSignature.__USE_PIN_SECURITY)
              {
                // Prompt for the password that allows returning to
                // the secure environment
                this.createLogin(
                  "Accept",
                  (err, username) =>
                  {
                    // Accepted?
                    if (err)
                    {
                      // Nope. Let them re-enter it
                      return;
                    }

                    saveSignature();
                  });
              }
              else
              {
                // Save the signature and ask the client to return the
                // tablet to the greeter
                saveSignature();
                this.awaitReturnToGreeter();
              }
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
              checkbox.setValue(priorValue); // revert indicator
              checkbox.setUserData("priorValue", priorValue);
            });
        });

      ! data.arrival_time && ! data.fulfilled && checkbox.hide();
      hidden.push(checkbox);
      treeItem.addWidget(checkbox);

      o = new qx.ui.basic.Label(
        "Family size:<br>" +
          `${data.family_size_count} (${data.family_size_text})`);
      o.set(
        {
          rich        : true,
          width       : 70,
          alignY      : "middle"
        });
      ! data.arrival_time && ! data.fulfilled && o.hide();
      hidden.push(o);
      treeItem.addWidget(o);

      o = new qx.ui.form.TextArea(data.notes || "");
      o.set(
        {
          singleStep   : 5,
          width        : 160,
          alignY       : "middle",
          readOnly     : true,
          appearance   : "label",
          decorator    : "greeter-notes",
          paddingLeft  : 2,
          paddingRight : 2
        });
      o.addListener(
        "appear",
        () =>
        {
          o.getContentElement().setStyles( { "line-height": 1 } );
        });
      ! data.arrival_time && ! data.fulfilled && o.hide();
      hidden.push(o);
      treeItem.addWidget(o);

      signature = new qx.ui.basic.Image();
      signature.set(
        {
          scale       : true,
          width       : 150,
          height      : 38,
          source      : data.usda_eligible_signature
        });
      ! data.arrival_time && ! data.fulfilled && signature.hide();
      hidden.push(signature);
      treeItem.addWidget(signature);

      fulfilled = new qx.ui.form.ToggleButton("Fulfilled");
      fulfilled.set(
        {
          width    : 100,
          maxWidth : 100,
        });
      ! data.arrival_time && ! data.fulfilled && fulfilled.hide();
      hidden.push(fulfilled);
      if (data.fulfilled)
      {
        fulfilled.set(
          {
            value : true,
            label : "Fulfilled",
            icon  : "qxl.dialog.icon.ok"
          });
      }
      else
      {
        fulfilled.set(
          {
            value : false,
            label : "Unfulfilled",
            icon  : "qxl.dialog.icon.warning"
          });
      }
      treeItem.addWidget(fulfilled);

      // Keep the button label synchronized with the button's state
      fulfilled.addListener(
        "changeValue",
        (e) =>
        {
          let newValue = e.getData();

          if (newValue)
          {
            fulfilled.setIcon("qxl.dialog.icon.ok");
            fulfilled.setLabel("Fulfilled");
          }
          else
          {
            fulfilled.setIcon("qxl.dialog.icon.warning");
            fulfilled.setLabel("Unfulfilled");
          }
        });

      // When tapped, issue the RPC to set the `fulfilled` value
      fulfilled.addListener(
        "tap",
        (e) =>
        {
          let newValue = fulfilled.getValue();

          this.rpc(
            "updateFulfilled",
            [
              distribution,
              data.family_name,
              newValue
            ])
          .catch(
            (e) =>
            {
              console.warn("updateFulfilled:", e);
              qxl.dialog.Dialog.alert(
                "Could not update fulfillment status for " +
                  `${data.family_name}: ${e.message}`);
            });
        });

      fulfilled.set(
        {
          marginRight : 8
        });

      topic = `appointmentFulfilled/${distribution}/${data.family_name}`;
      qx.event.message.Bus.subscribe(
        topic,
        (message) =>
        {
          let             messageData = message.getData();

          fulfilled.setValue(messageData.fulfilled);
        },
        this);

      o = new qx.ui.form.Button("More");
      o.set(
        {
          width    : 50,
          maxWidth : 50
        });
      ! data.arrival_time && ! data.fulfilled && o.hide();
      hidden.push(o);
      treeItem.addWidget(o);

      // When tapped, create the form for "more options"
      o.addListener(
        "execute",
        () =>
        {
          let             p;

          let moreForm = new qxl.dialog.Form(
            {
              caption   : `${data.family_name}`,
              context   : this,
            });
          let formData =
            {
              memo :
              {
                type       : "TextArea",
                label      : "Memo",
                lines      : 3,
                value      : data.memo || ""
              },

              verified :
              {
                type       : "Checkbox",
                label      : (data.verified
                              ? "Residency Verified"
                              : "Residency Unverified"),
                value      : !! data.verified,
                width      : 200,
                properties :
                {
                  height     : 50,
                  appearance : "toggle-button",
                  marginLeft : 106
                },
                events    :
                {
                 changeValue :
                  function(e)
                  {
                    if (e.getData())
                    {
                      this.setLabel("Residency Verified");
                    }
                    else
                    {
                      this.setLabel("Residency Unverified");
                    }
                  }
                }
              },

              cancelArrived :
              {
                type       : "Checkbox",
                label      : "Cancel Arrival",
                width      : 200,
                properties :
                {
                  height     : 50,
                  appearance : "toggle-button",
                  marginLeft : 106
                },
                events    :
                {
                 changeValue :
                  function(e)
                  {
                    if (e.getData())
                    {
                      this.setLabel("Will Cancel Arrival...");
                    }
                    else
                    {
                      this.setLabel("Cancel Arrival");
                    }
                  }
                }
              }
            };

          moreForm.set(
            {
              width    : 500,
              height   : 300,
              formData : formData
            });

          moreForm._okButton.set(
            {
              label   : "Save"
            });

          moreForm.show();

          p = moreForm.promise();

          p.then(
            (formValues) =>
            {
              // If cancelled, there's nothing to do
              if (! formValues)
              {
                return;
              }

              this.rpc("updateFulfillmentAncillary",
                       [
                         distribution,
                         data.family_name,
                         formValues.memo,
                         formValues.verified,
                         formValues.cancelArrived
                       ])
                .then(
                  () =>
                  {
                    // Save the new values in case the form is created again
                    data.memo = formValues.memo;
                    data.verified = formValues.verified;

                    // If arrival was cancelled and not fulfulled,
                    // reset hidden fields
                    if (formValues.cancelArrived && ! data.fulfilled)
                    {
                      arrived.show();
                      hidden.forEach((widget) => widget.hide());
                    }

                    // Reset the label and color based on new verified status
                    text =
                      qx.bom.String.escape(data.family_name) +
                      (data.verified ? "" : "<br>RESIDENCY UNVERIFIED");

                    label.set(
                      {
                        value     : text,
                        textColor : data.verified ? null : "red"
                      });
                  })
                .catch(
                  (e) =>
                  {
                    console.warn("updateFulfillmentMore:", e);
                    qxl.dialog.Dialog.alert(
                      "Could not update fulfullment ancillary data: " +
                      e.message);
                  });
            });
        });

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
     * @param callback
     */
    createLogin : function(caption, callback)
    {
      this._loginWidget = new qxl.dialog.Login(
        {
          text                  : "Please provide PIN to continue",
          checkCredentials      : this.loginCheckCredentials.bind(this),
          callback              : callback,
          showForgotPassword    : false,
          caption               : caption
      });

      // User need not enter the name, only the actual PIN
      this._loginWidget._username.set(
        {
          value   : "PIN",
          enabled : false
        });

      this._loginWidget.addListener(
        "appear",
        () =>
        {
          // Focus the password field
          this._loginWidget._password.focus();
        });

      this._loginWidget.show();
    },

    /**
     * Inform the client to return the tablet to the greeter
     * @return {Promise}
     */
    awaitReturnToGreeter : function()
    {
      let             root = this.getRoot();
      let             rootSize = root.getInnerSize();

      let alert = new qxl.dialog.Alert(
        {
          message  : "Thank you. Please hand the tablet back to your greeter.",
          context  : this,
          caption  : "Signature complete",
          image    : "qxl.dialog.icon.info"
        });

      // Make the confirm box easily usable on a phone/tablet
      alert._message.setFont(qx.bom.Font.fromString("bold 35px Arial"));
      alert.set(
        {
          width  : rootSize.width,
          height : rootSize.height
        });
      alert._okButton.set(
        {
          width  : 100,
          height : 50
        });

      alert.show();

      // Show Ok button at bottom instead of right after message
      alert.getDialogContainer().addAt(
        new qx.ui.core.Spacer(),
        1,
        { flex : 1 });

      return alert.promise();
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
        this._loginWidget._password.setValue("");
      }
    }
  }
});
