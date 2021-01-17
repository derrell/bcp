/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2021 Derrell Lipman
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
console.log("getDeliveryDay data:", result);
                if (! result || result.appointments.length === 0)
                {
                  qxl.dialog.Dialog.alert("No appoitments scheduled");
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
          width: 1000
        });
      tree.addListener(
        "changeSelection",
        () =>
        {
          tree.resetSelection();
        });
      container.add(tree, { flex : 1 });

      root = this.configureTreeItem(new qx.ui.tree.TreeFolder(), distribution);
      root.setOpen(true);
      tree.setRoot(root);

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
              appointment.method == "Delivery" ? "Delivery" : `Day ${day}`;
            nodes[day] = this.configureTreeItem(new Branch(), label);
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
    },

    configureTreeItem : function(treeItem, data, distribution)
    {
      let             o;
      let             checkbox;
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

      // On leaves, add a checkbox for indicating it's been Fulfilled
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
//        checkbox.getChildControl("icon").exclude();
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
//            checkbox.getChildControl("icon").show();
            checkbox.setIcon("qxl.dialog.icon.warning");
            checkbox.setLabel("Unfulfilled");
          }
          else
          {
//            checkbox.getChildControl("icon").exclude();
            checkbox.setIcon("qxl.dialog.icon.ok");
            checkbox.setLabel("Fulfilled");
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

      // Set the row's background color
      treeItem.setBackgroundColor(
        MDeliveryDay._appointmentRowColor[this._nextAppointmentRowColor]);
      this._nextAppointmentRowColor = (this._nextAppointmentRowColor + 1) % 2;

      return treeItem;
    }
  }
});
