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
qx.Mixin.define("bcp.client.MGroceries",
{
  events :
  {
    /** The grocery list has changed, e.g., by adding/editing an item */
    groceryListChanged : "qx.event.type.Event"
  },

  members :
  {
    /** The grocery list table */
    _groceryTable     : null,

    /** The grocery list table model */
    _tmGrocery        : null,

    /** This tab's label */
    _tabLabelGrocery  : null,

    /**
     * Create the grocery list page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createGroceryListTab(tabView)
    {
      let             page;
      let             pageItems;
      let             pageCategories;
      let             tm;
      let             table;
      let             tcm;
      let             hBox;
      let             button;
      let             command;
      let             butNewItem;
      let             label;
      let             data;
      let             custom;
      let             behavior;
      let             cellRenderer;

      // Generate the label for this tab
      this._tabLabelGrocery = this.underlineChar("Groceries", 2);

      page = new qx.ui.tabview.Page(this._tabLabelGrocery);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+O");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      // Create the local tabview for selection between the grocery
      // list and grocery categories
      tabView = new qx.ui.tabview.TabView("left");
      page.add(tabView, { flex : 1 });

      pageItems = new qx.ui.tabview.Page("Items");
      pageItems.setLayout(new qx.ui.layout.VBox());
      tabView.add(pageItems);

      pageCategories = new qx.ui.tabview.Page("Categories");
      pageCategories.setLayout(new qx.ui.layout.VBox());
      tabView.add(pageCategories);

      this._tmGrocery = tm = new qx.ui.table.model.Simple();
      tm.setColumns(
        [
          "Item",
          "Category",
          "Perishable",
          "Aisle",
          "Shelf unit #",
          "Side of aisle",
          "Shelf #",
          "Stock on hand",
          "Vendor contact info"
        ],
        [
          "item",
          "category_name",
          "perishable",
          "dist_aisle",
          "dist_unit",
          "dist_side",
          "dist_shelf",
          "on_hand",
          "order_contact"
        ]);

      // TODO
      this.rpc("getGroceryList", [])
        .then(
          (result) =>
          {
            if (! result)
            {
              return;
            }

            // Add the provided grocery list, munging column data as necessary
            result = result.map(
              (item) =>
              {
                this._mungeGroceryItem(item);
                return item;
              });
            this._tmGrocery.setDataAsMapArray(result, true);

            // Sort initially by the Item column
            this._tmGrocery.sortByColumn(
              this._tmGrocery.getColumnIndexById("item"), true);
          })
        .catch(
          (e) =>
          {
            console.warn("getGroceryList:", e);
            qxl.dialog.Dialog.alert(
              `Could not retrieve grocery list: ${e.message}`);
          });

      // Prepare to use the Resize column model, for better column widths
      custom =
        {
          tableColumnModel : (obj) => new qx.ui.table.columnmodel.Resize(obj)
        };

      table = this._groceryTable = new qx.ui.table.Table(tm, custom).set(
        {
          statusBarVisible       : false,
          showCellFocusIndicator : false,
          minHeight              : 100,
          height                 : 100
        });
      pageItems.add(table, { flex : 1 });

      tcm = table.getTableColumnModel();

      // Specify column widths
      behavior = tcm.getBehavior();
      behavior.setWidth(tm.getColumnIndexById("item"), 200);
      behavior.setWidth(tm.getColumnIndexById("perishable"), 100);
      behavior.setWidth(tm.getColumnIndexById("dist_aisle"), 100);
      behavior.setWidth(tm.getColumnIndexById("dist_unit"), 100);
      behavior.setWidth(tm.getColumnIndexById("dist_side"), 100);
      behavior.setWidth(tm.getColumnIndexById("dist_shelf"), 100);
      behavior.setWidth(tm.getColumnIndexById("on_hand"), 120);
//      behavior.setWidth(tm.getColumnIndexById("order_contact"), "*");

      // Sort item case insensitive
      tm.setSortMethods(
        tm.getColumnIndexById("item"),
        (a, b) =>
        {
          let             index;

          // Get the index of the item column
          index = tm.getColumnIndexById("item");

          a = a[index].toLowerCase();
          b = b[index].toLowerCase();

          return a < b ? -1 : a > b ? 1 : 0;
        });

      // Sort Aisle by Aisle then Shelf unit # then Side of aisle then Shelf #
      tm.setSortMethods(
        tm.getColumnIndexById("aisle"),
        (a, b) =>
        {
          let             idxAisle = tm.getColumnIndexById("dist_aisle");
          let             idxUnit  = tm.getColumnIndexById("dist_unit");
          let             idxSide  = tm.getColumnIndexById("dist_side");
          let             idxShelf = tm.getColumnIndexById("dist_shelf");

          if (a[idxAisle] < b[idxAisle]) return -1;
          if (a[idxAisle] > b[idxAisle]) return 1;

          if (a[idxUnit]  < b[idxUnit])  return -1;
          if (a[idxUnit]  > b[idxUnit])  return 1;

          if (a[idxSide]  < b[idxSide])  return -1;
          if (a[idxSide]  > b[idxSide])  return 1;

          if (a[idxShelf] < b[idxShelf]) return -1;
          if (a[idxShelf] > b[idxShelf]) return 1;

          return 0;
        });

      // The 'perishable' column shows a checkmark when item is perishable
      cellRenderer = new qx.ui.table.cellrenderer.Boolean();
      cellRenderer.set(
        {
          iconTrue  : "qxl.dialog.icon.ok"
        });
      tcm.setDataCellRenderer(tm.getColumnIndexById(
        "perishable"), cellRenderer);

      // Create an hbox for the buttons at the bottom. Force some
      // space above it
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox(4));
      hBox.set(
        {
          marginTop : 20
        });
      pageItems.add(hBox);

      // Handle tap to edit an existing grocery item
      table.addListener(
        "cellTap",
        (e) =>
        {
          let             row = e.getRow();
          this._buildGroceryItemForm(tm.getDataAsMapArray()[row], row);
          table.getSelectionModel().resetSelection();
        });

      // Prepare to create a new item
      butNewItem = new qx.ui.form.Button("New Item");
      hBox.add(butNewItem);

      butNewItem.addListener(
        "execute",
        function()
        {
          this._buildGroceryItemForm();
        },
        this);

      // Add the grocery category editor when its page appears; remove
      // it when its page disappears, so that it always has fresh data
      tabView.addListener(
        "changeSelection",
        (e) =>
        {
          if (e.getData()[0] == pageCategories)
          {
            Promise.resolve()
              .then(() => this._getGroceryCategoryList())
              .then(
                (categories) =>
                {
                  let categoryEditor =
                    new bcp.client.grocery.CategoryEditor(
                      qx.data.marshal.Json.createModel(categories, true));
                  pageCategories.add(categoryEditor, { flex : 1 });
                });
          }
          else
          {
            pageCategories.removeAll();
          }
        });
    },

    /**
     * The database data isn't quite in the form that we want to display it.
     * Alter some fields for display.
     *
     * @param item {Map}
     *   The data for a single grocery item
     */
    _mungeGroceryItem(item)
    {
      // Convert perishable from numeric 0/1 to boolean false/true
      if (item.perishable === 1)
      {
        item.perishable = true;
      }
      else if (item.perishable === 0)
      {
        item.perishable = null;
      }

      // If no category name, put it into "Uncategorized"
      if (item.category_name === null)
      {
        item.category_name = "Uncategorized";
      }
    },

    /**
     * Build the New/Edit Grocery Item form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildGroceryItemForm(itemInfo, row)
    {
      let             p;
      let             form;
      let             formData;
      let             message;
      let             categories;
      const           bNew = ! itemInfo;
      const           caption = "Grocery Item Detail";
      const           _this = this;
      
      // Ensure there's a map we can dereference for default values
      itemInfo = itemInfo || {};

      message =
        bNew
        ? "<span style='font-weight: bold;'>New Grocery Item</span>"
        : "";

      Promise.resolve()
        .then(() => this._getGroceryCategoryList())
        .then(
          (categoryList) =>
          {
            // Save the category list
            categories = categoryList;
console.log("buildGroceryItemForm: categories=", categories);

            // Build the form
            formData =
              {
                item :
                {
                  type       : "TextField",
                  label      : "Item Name",
                  value      : itemInfo.item || "",
                  validation :
                  {
                    required   : true
                  },
                  properties :
                  {
                    tabIndex   : 1
                  },
                  userdata :
                  {
                    row        : 1
                  }
                },
                perishable :
                {
                  type       : "SelectBox",
                  label      : "Perishable",
                  value      : itemInfo.perishable ? 1 : 0,
                  options :
                  [
                    { label : "No",    value : 0 },
                    { label : "Yes",   value : 1 }
                  ],
                  properties :
                  {
                    maxWidth   : 60,
                    tabIndex   : 2
                  }
                },
                dist_aisle :
                {
                  type       : "SelectBox",
                  label      : "Aisle",
                  value      : itemInfo.dist_aisle || "",
                  options :
                  [
                    { label : "A",    value : "A" },
                    { label : "B",    value : "B" },
                    { label : "C",    value : "C" },
                    { label : "D",    value : "D" },
                    { label : "E",    value : "E" },
                    { label : "F",    value : "F" },
                    { label : "G",    value : "G" },
                    { label : "X",    value : "X" },
                    { label : "Y",    value : "Y" },
                    { label : "Z",    value : "Z" }
                  ],
                  properties :
                  {
                    maxWidth   : 60,
                    tabIndex   : 3
                  }
                },
                dist_unit :
                {
                  type       : "SelectBox",
                  label      : "Shelf Unit #",
                  value      : itemInfo.dist_unit || "",
                  options :
                  [
                    { label : "1",    value : "1" },
                    { label : "2",    value : "2" },
                    { label : "3",    value : "3" },
                    { label : "4",    value : "4" },
                    { label : "5",    value : "5" },
                    { label : "6",    value : "6" },
                    { label : "10",    value : "10" },
                    { label : "11",    value : "11" },
                    { label : "12",    value : "12" },
                    { label : "00",    value : "00" },
                    { label : "01",    value : "01" },
                    { label : "02",    value : "02" }
                  ],
                  properties :
                  {
                    maxWidth   : 60,
                    tabIndex   : 4
                  }
                },
                dist_side :
                {
                  type       : "SelectBox",
                  label      : "Side of Aisle",
                  value      : itemInfo.dist_side || "L",
                  options :
                  [
                    { label : "Left",   value : "L" },
                    { label : "Right",  value : "R" }
                  ],
                  properties :
                  {
                    maxWidth   : 60,
                    tabIndex   : 5
                  }
                },
                dist_shelf :
                {
                  type       : "SelectBox",
                  label      : "Shelf #",
                  value      : itemInfo.income_source || "",
                  options :
                  [
                    { label : "a (top shelf)",  value : "a" },
                    { label : "b",        value : "b" },
                    { label : "c",        value : "c" },
                    { label : "d",        value : "d" }
                  ],
                  properties :
                  {
                    maxWidth   : 110,
                    tabIndex   : 6
                  }
                },
                on_hand :
                {
                  type       : "SelectBox",
                  label      : "Stock on hand",
                  value      : itemInfo.dist_side || "L",
                  options :
                  [
                    { label : "Plenty in stock",   value : "Plenty" },
                    { label : "Re-order soon",     value : "Reorder" },
                    { label : "Currently unused",  value : "Ignore" }
                  ],
                  properties :
                  {
                    tabIndex   : 7
                  }
                },
                order_contact :
                {
                  type       : "TextArea",
                  label      : "Vendor Contact Info",
                  value      : itemInfo.order_contact || "",
                  lines      : 3,
                  userdata   :
                  {
                    rowspan    : 2
                  },
                  properties :
                  {
                    tabIndex   : 8
                  }
                },
                category_label :
                {
                  type       : "Label",
                  label      : "Category:",
                  userdata   :
                  {
                    row        : 0,
                    column     : 2
                  }
                },
                category :
                {
                  type       : "groceryCategories",
                  label      : null,
                  value      : itemInfo.category,
                  userdata   :
                  {
                    row        : 1,
                    column     : 1,
                    rowspan    : 9,
                    modelData  : categories
                  }
                }
              };

            form = new qxl.dialog.Form(
            {
              caption                   : caption,
              message                   : message,
              context                   : this,
              afterButtonsFunction : function(buttonBar, form)
              {
                let             butDelete;

                // If the user doesn't have permission to delete (level 60),
                // then there's no reason to add a Delete button
                if (_this._me.permissionLevel < 60)
                {
                  return;
                }

                // Create the Delete button
                butDelete = new qx.ui.form.Button("Delete");
                butDelete.setWidth(60);

                butDelete.addListener(
                  "execute",
                  () =>
                  {
                    let             confirm;

                     confirm = qxl.dialog.Dialog.confirm(
                       "Are you absolutely sure you want to delete this item? ",
                      (result) =>
                      {
                        // If they didn't confirm, we have nothing to do
                        if (! result)
                        {
                          return;
                        }

                        // Do normal form cancellation
                        form._cancelButton.execute();

                        // Issue the request to delete this grocery item
                        _this.rpc(
                          "deleteGroceryItem",
                          [
                            {
                              item  : itemInfo.item
                            }
                          ])
                          .catch(
                            (e) =>
                            {
                              console.warn("Error deleting grocery item:", e);
                              qxl.dialog.Dialog.error(
                                `Error deleting grocery item: ${e}`);
                            })

                          // Re-retrieve the grocery list
                          .then(
                            () =>
                            {
                              this.rpc("getGroceryList", [])
                                .then(
                                  (result) =>
                                  {
                                    if (! result)
                                    {
                                      return;
                                    }

                                    // Add the provided grocery list, munging
                                    // column data as necessary
                                    result = result.map(
                                      (item) =>
                                      {
                                        this._mungeGroceryItem(item);
                                        return item;
                                      });

                                    // Add the provided grocery list
                                    this._tmGrocery.setDataAsMapArray(result, true);

                                    // Sort initially by the Item column
                                    this._tmGrocery.sortByColumn(
                                      this._tmGrocery.getColumnIndexById("item"),
                                      true);
                                  })
                                .catch(
                                  (e) =>
                                  {
                                    console.warn("getGroceryList:", e);
                                    qxl.dialog.Dialog.alert(
                                      "Could not retrieve grocery list: " +
                                        e.message);
                                  });
                            });
                      },
                      null,
                      "Confirm");
                    confirm.setWidth(500);
                  });

                // Add the delete button at far left, and add spacer to
                // center Save/Cancel buttons
                buttonBar.addAt(butDelete, 0);
                buttonBar.addAt(new qx.ui.core.Spacer(), 1, { flex : 1 });
              },
              setupFormRendererFunction : function(form) {
                var         renderer = new qxl.dialog.FormRenderer(form);
                var         renderer = new qxl.dialog.MultiColumnFormRenderer(form);
                var         layout = new qx.ui.layout.Grid();
                const       col = renderer.column;

                layout.setSpacing(6);

                layout.setColumnMaxWidth(col(0), this.getLabelColumnWidth());
                layout.setColumnWidth(col(0), this.getLabelColumnWidth());
                layout.setColumnAlign(col(0), "right", "top");

                layout.setColumnMaxWidth(col(1), 1);
                layout.setColumnWidth(col(1), 10);
                layout.setColumnAlign(col(1), "left", "top");

                layout.setColumnFlex(col(2), 1);
                layout.setColumnAlign(col(2), "left", "top");

                renderer._setLayout(layout);

                // Give 'em what they came for
                return renderer;
              }
            });

            form.set(
              {
                labelColumnWidth : 150,
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
                // If the item field is enabled...
                if (form._formElements["item"].getEnabled())
                {
                  // ... then focus it
                  form._formElements["item"].focus();
                }
                else
                {
                  // Otherwise, focus the default delivery address field
                  form._formElements["perishable"].focus();
                }
              },
              this);
          })
        .then(() => form.promise())

        .then(
          (formValues) =>
          {
            // Cancelled?
            if (! formValues)
            {
              // Yup. Nothing to do
              return;
            }

            // Add the record name to be updated, in case of rename
            formValues.item_update = itemInfo.item || formValues.item;

            // If the category changed, the value is just the new id
            // number. If it didn't change, it's still the original
            // array of map from which we should extract the id number.
            if (Array.isArray(formValues.category))
            {
              formValues.category = formValues.category[0].id;
            }

            console.log("formValues=", formValues);

            this.rpc("saveGroceryItem", [ formValues, bNew ])
              .then(
                (result) =>
                {
                  console.log(`saveGroceryItem result: ${result}`);

                  // A result means something failed.
                  if (result)
                  {
                    qxl.dialog.Dialog.error(result);
                    return;
                  }

                  // Find this item in the table
                  row =
                    this._tmGrocery
                    .getDataAsMapArray()
                    .map(rowData => rowData.item)
                    .indexOf(formValues.item_update);

                  this._mungeGroceryItem(formValues);

                  // Does it already exist?
                  if (row >= 0)
                  {
                    // Yup. Replace the data for that row
                    this._tmGrocery.setRowsAsMapArray(
                      [formValues], row, true, false);
                  }
                  else
                  {
                    // It's new. Add it.
                    this._tmGrocery.addRowsAsMapArray(
                      [formValues], null, true, false);
                  }

                  // Resort  by the Item column
                  this._tmGrocery.sortByColumn(
                    this._tmGrocery.getSortColumnIndex(), true);

                  // Let listeners know the grocery list changed
                  this.fireDataEvent(
                    "groceryListChanged",
                    {
                      item : formValues.item
                    });

                })
              .catch(
                (e) =>
                {
                  console.warn("Error saving changes:", e);
                  if (e.code == this.constructor.RpcError.AlreadyExists)
                  {
                    qxl.dialog.Dialog.error(
                      `Item "${formValues.item}" already exists`);
                  }
                  else
                  {
                    qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
                  }
                });
          });
    },

    async _getGroceryCategoryList()
    {
      return this.rpc("getGroceryCategoryList", [])
        .then(result => this._groceryListToTreeData(result));
    },

    async _groceryListToTreeData(list)
    {
      let             idMap = {};

      return Promise.resolve(list)
        .then(
          (list) =>
          {
            let             treeData = [];

            list.forEach(
              (item) =>
              {
                let             parentItem;

                // If this is a category, it has members id, parent, name;
                // If it's an item, it has members category and fmaily_name
                if ("id" in item && "parent" in item)
                {
                  // It's a category

                  // Add this node to our map so we can find it if it's
                  // any subsequent item's parent
                  idMap[item.id] = item;

                  // We should always find the parent in the map, unless
                  // it's the root item
                  parentItem = idMap[item.parent];

                  // Add a children array and open property.
                  item.children = [];
                  item.label = item.name;
                  item.notes = "";
                  item.notesVisibility = "hidden";
                  item.checked = null;
                  item.open = true;
                }
                else
                {
                  // It's an item
                  parentItem = idMap[item.category || 0];
                  item.parent = item.category;
                  item.label = item.item;
                  item.notesVisibility = "visible";
                  item.checked = !! item.wanted;
                  item.open = false;

                  for (let field in item)
                  {
                    if (!
                        [
                          "id",
                          "parent",
                          "name",
                          "label", // identical to name; both needed
                          "checked",
                          "notes",
                          "notesVisibility"
                        ].includes(field))
                    {
                      delete item[field];
                    }
                  }
                }

                // If found, add this item to its parent's children
                if (parentItem)
                {
                  parentItem.children.push(item);
                }
                else
                {
                  // It's the root item
                  treeData.push(item);
                }
              });

            return treeData;
          })
        .then(
          (treeData) =>
          {
            const sorter =
              (node) =>
              {
                // If this node has no children, there's nothing to do
                if (! node.children) return;

                // First, sort this node's children
                node.children.forEach(child => sorter(child));

                // Sort this node's children
                node.children = node.children.sort(
                  (a, b) =>  a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
              };

            // If there are any nodes, sort them, recursively
            treeData.length > 0 && sorter(treeData[0]);

            return treeData;
          });
    }
  }
});
