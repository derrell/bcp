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
qx.Mixin.define("bcp.client.MDeliveryDay",
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
    _nextAppointmentRowColor : 0,
    _tabLabelDeliveryDay     : null,
    _shoppersForm            : null,
    _shoppers                : null,

    /**
     * Create the delivery day page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createDeliveryDayTab(tabView)
    {
      let             page;
      let             button;
      let             command;

      // Generate the label for this tab
      this._tabLabelDeliveryDay = this.underlineChar("Delivery Day");

      page = new qx.ui.tabview.Page(this._tabLabelDeliveryDay);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+D");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      // Retrieve the delivery day information when the page appears
      page.addListener(
        "appear",
        () =>
        {
          page.removeAll();

          this.rpc("getDeliveryDay", [])
            .then(
              (result) =>
              {
                if (! result || result.appointments.length === 0)
                {
                  qxl.dialog.Dialog.alert("No appointments scheduled");
                  return;
                }

                this._buildDeliveryDayTree(page, result);
              })
            .catch(
              (e) =>
              {
                console.warn("getDeliveryDay:", e);
                qxl.dialog.Dialog.alert(
                  `Could not retrieve delivery day information: ${e.message}`);
              });
        });
    },

    _buildDeliveryDayTree : function(page, deliveryInfo)
    {
      let             vBox;
      let             tree;
      let             scroller;
      let             container;
      let             root;
      let             today;
      let             buttonBar;
      let             button;
      let             nodes = {};
      const           { distribution, appointments, shoppers } = deliveryInfo;

      // Get today's date in the same format as a distribution appointment date
      today = new Date();
      today =
        today.getFullYear() + "-" +
        ("0" + (today.getMonth() + 1)).substr(-2) + "-" +
        ("0" + today.getDate()).substr(-2);

      scroller = new qx.ui.container.Scroll();
      container = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      container.setAllowGrowX(false);
      container.setAllowStretchX(false);
      scroller.add(container);
      page.add(scroller, { flex : 1 });

      tree = new qx.ui.tree.Tree().set(
        {
          width: 1100
        });
      tree.addListener(
        "changeSelection",
        () =>
        {
          tree.resetSelection();
        });
      container.add(tree, { flex : 1 });

      root = this.configureTreeItem(
        new qx.ui.tree.TreeFolder(),
        "Distribution start date: " + distribution);
      root.setOpen(true);
      tree.setRoot(root);

      // Built the shoppers list
      this._shoppers = {};
      shoppers.forEach(
        (shopper) =>
        {
          this._shoppers[shopper.id] = shopper.name;
        });
console.log("Initial shopper list:", this._shoppers);

      appointments.forEach(
        (appointment) =>
        {
          let             node;
          let             parent;
          let             label;
          const           day = appointment.appt_day;
          const           time = appointment.appt_time;
          const           Branch = qx.ui.tree.TreeFolder;
          const           Leaf = qx.ui.tree.TreeFile;

          // Have we not yet created a node for this day?
          if (! nodes[day])
          {
            // We haven't. Create it.
            label =
              appointment.method == "Delivery"
              ? "Delivery"
              : `Day ${day} (${appointment.appt_date})`;
            nodes[day] = this.configureTreeItem(new Branch(), label);
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
                this.configureTreeItem(
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
          node = this.configureTreeItem(new Leaf(), appointment, distribution);
          parent.add(node);
        });

      // Add the button bar
      buttonBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      container.add(buttonBar);

      // Add the button to bring up the shopper assignment form, centered
      button = new qx.ui.form.Button("Shoppers");
      button.set(
        {
          width : 100
        });

      buttonBar.add(new qx.ui.core.Spacer(), { flex : 1 });
      buttonBar.add(button);
      buttonBar.add(new qx.ui.core.Spacer(), { flex : 1 });

      button.addListener(
        "execute",
        () =>
        {
          this._createShoppersAssignmentForm();
        });
    },

    configureTreeItem : function(treeItem, data, distribution)
    {
      let             o;
      let             topic;
      let             arrived;
      let             memo;
      let             checkbox;
      let             assignToShopper;
      const           MDeliveryDay = bcp.client.MDeliveryDay;

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
        this._nextAppointmentRowColor = 0;

        // All done here, for a branch.
        return treeItem;
      }

      // Right-justify the rest
      treeItem.addWidget(new qx.ui.core.Spacer(), { flex: 1 });

      data.id = ("00" + data.id).substr(-3);
      o = new qx.ui.basic.Label(`#${data.id}`);
      o.set(
        {
          width  : 50,
          alignX : "right",
          alignY : "middle",
          font   : qx.bom.Font.fromString("bold 16px Arial")
        });
      treeItem.addWidget(o);

      arrived =
        new qx.ui.basic.Image("bcp/client/decoration/icons8-car-32.png");
      arrived.setToolTipText(data.arrival_time);
      if (! data.arrival_time || data.fulfilled)
      {
        arrived.hide();
      }
      topic = `clientArrived/${distribution}/${data.family_name}`;
      qx.event.message.Bus.subscribe(
        topic,
        (message) =>
        {
          let             messageData = message.getData();

          // A greeter indicates that a client has arrived. Show it here.
          if (messageData.arrivalTime && ! data.fulfilled)
          {
            arrived.setToolTipText(messageData.arrivalTime);
            arrived.show();
          }
          else
          {
            arrived.hide();
          }
        },
        this);
      treeItem.addWidget(arrived);

      // add some space between 'arrived' icon and 'Fulfilled'
      treeItem.addWidget(new qx.ui.core.Spacer(4, 4));

      // Add a pulldown to assign to an available shopper
      assignToShopper = new qx.ui.form.SelectBox();
      assignToShopper.set(
        {
          focusable   : false,
          height      : 18,
          width       : 100,
          marginRight : 12,
          paddingTop  : 2,
          enabled     : ! data.fulfilled
        });
      
      // Add the shoppers to the list
      let item = new qx.ui.form.ListItem("");
      item.setUserData("id", 0);
      assignToShopper.add(item);

      for (let shopperId in this._shoppers)
      {
        let item = new qx.ui.form.ListItem(this._shoppers[shopperId]);
        item.setUserData("id", shopperId);
        assignToShopper.add(item);
      }
      treeItem.addWidget(assignToShopper);

      // Save assignment changes
      assignToShopper.addListener(
        "changeSelection",
        (e) =>
        {
console.log("changeSelection distribution=", distribution, ", family=", data.family_name, ", label=", e.getData()[0].getLabel() + ", id=", e.getData()[0].getUserData("id"));
        });

      // Add a checkbox for indicating it's been Fulfilled
      checkbox = new qx.ui.form.ToggleButton(
        "Unfulfilled", "qxl.dialog.icon.warning");
      checkbox.set(
        {
          focusable   : false,
          value       : !! data.fulfilled,
          height      : 18,
          width       : 100,
          marginRight : 12,
          paddingTop  : 2
        });
      if (data.fulfilled)
      {
        checkbox.setIcon("qxl.dialog.icon.ok");
        checkbox.setLabel("Fulfilled");
      }

      // Keep the button label synchronized with the button's state
      checkbox.addListener(
        "changeValue",
        () =>
        {
          if (! checkbox.getValue())
          {
            checkbox.setIcon("qxl.dialog.icon.warning");
            checkbox.setLabel("Unfulfilled");
            data.arrival_time && arrived.show();

            // Also set enabled state of the shopper assignment
            assignToShopper.setEnabled(false);
          }
          else
          {
            checkbox.setIcon("qxl.dialog.icon.ok");
            checkbox.setLabel("Fulfilled");
            arrived.hide();

            // Also set enabled state of the shopper assignment
            assignToShopper.setEnabled(true);
          }
        });

      // When this checkbox is tapped, mark as fulfilled
      checkbox.addListener(
        "tap",
        () =>
        {
          this.rpc(
            "updateFulfilled",
            [ distribution, data.family_name, checkbox.getValue() ])
            .then(
              () =>
              {
                console.log(`Updated fulfillment for ${data.family_name}`);
              })
            .catch(
              (e) =>
              {
                console.warn("updateFulfilled:", e);
                qxl.dialog.Dialog.alert(
                  "Could not update fulfilled status for " +
                    `${data.family_name}: ${e.message}`);
              });
        });

      topic = `appointmentFulfilled/${distribution}/${data.family_name}`;
      qx.event.message.Bus.subscribe(
        topic,
        (message) =>
        {
          let             messageData = message.getData();

          checkbox.setValue(messageData.fulfilled);
        },
        this);

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
          width             : 180,
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

      memo = new qx.ui.form.TextArea(data.memo ? `Memo: ${data.memo}` : "");
      memo.set(
        {
          singleStep        : 5,
          width             : 180,
          alignY            : "middle",
          readOnly          : true,
          appearance        : "label"
        });
      memo.addListener(
        "appear",
        () =>
        {
          memo.getContentElement().setStyles( { "line-height": 1 } );
        });
      treeItem.addWidget(memo);

      topic = `clientAncillary/${distribution}/${data.family_name}`;
      qx.event.message.Bus.subscribe(
        topic,
        (message) =>
        {
          let             messageData = message.getData();

          memo.setValue(messageData.memo ? `Memo: ${messageData.memo}` : "");
        },
        this);

      // Set the row's background color
      treeItem.setBackgroundColor(
        MDeliveryDay._appointmentRowColor[this._nextAppointmentRowColor]);
      this._nextAppointmentRowColor = (this._nextAppointmentRowColor + 1) % 2;

      return treeItem;
    },

    _createShoppersAssignmentForm()
    {
      this._shoppersForm = new qxl.dialog.Form();

      this.rpc("getShoppers", [])
        .then(
          (shoppers) =>
          {
            let             root;
            let             rootSize;
            let             fShoppersResizeForm;
            let             formData = {};

            shoppers.forEach(
              (shopper) =>
              {
                formData[shopper.id + "_name"] =
                  {
                    type       : "TextField",
                    label      : `Shopper ${shopper.id}'s name`,
                    value      : shopper.name
                  };

                formData[shopper.id + "_assignment"] =
                  {
                    type       : "TextField",
                    label      : "Assignment",
                    value      : shopper.assigned_to_family
                  };
              });

            root = this.getRoot();
            rootSize = root.getInnerSize();
            this._shoppersForm.set(
              {
                message          : "Shopper Assignment",
                labelColumnWidth : 150,
                formData         : formData,
                width            : rootSize.width,
                height           : rootSize.height,
              });

            fShoppersResizeForm =
              (e) =>
              {
                let             data = e.getData();

                this._shoppersForm.set(
                  {
                    width           : data.width,
                    height          : data.height
                  });
              };

            // If the window resizes, resize the form to fill the
            // available space.
            root.addListener("resize", fShoppersResizeForm);

            // Stop trying to resize the form when the form closes
            [ "ok", "cancel" ].forEach(
              (event) =>
              {
                this._shoppersForm.addListenerOnce(
                  event,
                  () =>
                  {
                    root.removeListener("resize", fShoppersResizeForm);
                  });
              });

            this._shoppersForm._okButton.set(
              {
                label  : "Save",
                width  : 100
              });

            this._shoppersForm._cancelButton.set(
              {
                label    : "Cancel",
                minWidth : 100
              });

            this._shoppersForm.center();
            this._shoppersForm.show();

            this._shoppersForm.promise()
              .then(
                (result) =>
                {
                  let             id;
                  let             shopper;
                  let             shoppers = [];

                  // If the form was cancelled...
                  if (! result)
                  {
                    return null;
                  }

                  // Rename key from, e.g., "1_name" to "1"
                  for (let key in result)
                  {
                    let             newKey = key.replace(/_.*/, "");
                    let             field = key.replace(/^.*_/, "");

                    if (newKey !== id)
                    {
                      id = newKey;
                      shopper = {};
                      shoppers[id] = shopper;
                    }

                    shoppers[id][field] = result[key];
                  }

                  return shoppers;
                })

              .then(
                (shoppers) =>
                {
                  if (! shoppers)
                  {
                    return;
                  }

                  this.rpc(
                    "updateShoppers",
                    shoppers)
                    .then(
                      () =>
                      {
                        // Create the new shoppers' names list
                        this._shoppers = {};
                        shoppers.forEach(
                          (shopper) =>
                          {
                            this._shoppers[shopper.id] = shopper.name;
                          });
                      })
                    .catch(
                      (e) =>
                      {
                        console.warn("updateShoppers:", e);
                        qxl.dialog.Dialog.alert(
                          `Could not update shoppers: ${e.message}`);
                      });
                });
          })

        .catch(
          (e) =>
          {
            console.warn("getShoppers:", e);
            qxl.dialog.Dialog.alert(`Could not get shoppers: ${e.message}`);
          });
    }
  }
});
