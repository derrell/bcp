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
          width: 1000
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
      let             rootSize;
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
          this._usdaForm = new qxl.dialog.Form(
            {
              callback         : function(result)
              {
                console.log("result=", result);
              }
              // finalizeFunction : function(form, formDialog)
              // {
              //   let             f;
              //   let             manager;
              //   const           appointments =
              //         formDialog._formElements["appointments"];

              //   //
              //   // Use a validation manager. Ensure that the entered data is
              //   // consistent, and that all required fields are entered.
              //   // When valid, enable the Save button.
              //   //

              //   // Instantiate a validation manager
              //   form._validationManager = manager =
              //     new qx.ui.form.validation.Manager();

              //   // Prepare a validation function
              //   f = function()
              //   {
              //     // Enable the Save button if the form validates
              //     manager.bind(
              //       "valid",
              //       formDialog._okButton,
              //       "enabled",
              //      {
              //         converter: function(value)
              //         {
              //           return value || false;
              //         }
              //       });

              //     // Reset warnings
              //     _this._requireAppointment.exclude();

              //     // An appointment time is required
              //     if (! appointments.getValue())
              //     {
              //       _this._requireAppointment.show();
              //       return false;
              //     }

              //     return true;
              //   }.bind(this);

              //   // Use that validator
              //   manager.setValidator(f);
              //   form.validate(manager);
              // }
            });

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

            rootSize = this.getRoot().getInnerSize();
            this._usdaForm.set(
              {
                message          : this.bold(
                  "I affirm that my monthly income is no greater than $3."),
                labelColumnWidth : 150,
                formData         : formData,
                width            : rootSize.width,
                height           : rootSize.height,
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

            this._usdaForm.promise()
              .then(
                (result) =>
                {
                  // If the form was cancelled...
                  if (! result)
                  {
                    // ... and get outta Dodge!
                    return Promise.resolve();
                  }

                  // return this.rpc("saveFulfillment", [ result ])
                  //   .catch(
                  //     (e) =>
                  //     {
                  //       console.warn("Error saving changes:", e);
                  //       qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                  //     });
                  console.log("form result=", result);
                  return Promise.resolve();
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

      // Set the row's background color
      treeItem.setBackgroundColor(
        MUsdaSignature._appointmentRowColor[this._nextSigAppointmentRowColor]);
      this._nextSigAppointmentRowColor =
        (this._nextSigAppointmentRowColor + 1) % 2;

      return treeItem;
    }
  }
});
