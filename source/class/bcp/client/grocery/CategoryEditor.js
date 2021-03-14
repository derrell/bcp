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
qx.Class.define("bcp.client.grocery.CategoryEditor",
{
  extend : qx.ui.container.Composite,

  construct(model)
  {
    let             tree;
    let             menu;
    let             prompt;
    let             dragDropImage;

    this.base(arguments, new qx.ui.layout.VBox());

    // Create and configure the tree
    this._tree = tree =
      new qx.ui.tree.VirtualTree(model.getItem(0), "name", "children", "open");
    this.add(tree, { flex : 1 });
    tree.set(
      {
        width     : 400,
        height    : 200,
        hideRoot  : false,
        showLeafs : false,      // ignore (hide) items in the tree, if any
        droppable : true,
        draggable : true
      });

    // Don't allow any selection
    tree._provider.isSelectable = () => false;

    // Allow an item to be dragged (moved) within the tree
    tree.addListener(
      "dragstart",
      (e) =>
      {
        e.addType("item");
        e.addAction("move");
      });

    // Allow dropping a node, to move one or add a new node
    tree.addListener(
      "drop",
      (e) =>
      {
        let             p;
        let             item;
        let             newItem;
        let             model;
        let             name;

        // Get the dropped-on item
        item = e.getOriginalTarget();

        // Ignore drop onto itself
        if (e.getDragTarget() == item)
        {
          return;
        }

        // Ignore drop onto something we can't drop onto
        if (! item.getModel)
        {
          return;
        }

        // Get the model of the item on which we'll add the dropped one.
        model = item.getModel();

        // Is this a "move" (drag within the tree) or "copy" (drag
        // from outside of the tree)?
        if (e.getCurrentAction() == "move")
        {
          // We're moving an item. Retrieve its model and remove the tree item
          newItem = e.getDragTarget().getModel();
          this.removeItem(tree.getModel(), newItem);

          // There's nothing to wait on
          p = Promise.resolve(newItem);
        }
        else
        {
          // We're adding an item. Create its model
          p = new Promise(
            (resolve, reject) =>
            {
              qxl.dialog.Dialog.prompt(
                "New category name?",
               (name) =>
               {
                 name = name.trim();

                 // If they didn't enter a name, choose one for them
                 if (! name)
                 {
                   name = "<unnamed>";
                 }

                 newItem = qx.data.marshal.Json.createModel(
                   {
                     id        : null,
                     name      : name,
                     open      : true,
                     parent    : model.getId(),
                     children  : []
                   });
                 resolve(newItem);
               });
            });
        }

        p.then(
          (newItem) =>
          {
            return qx.core.Init.getApplication().rpc(
              "saveGroceryCategory",
              [
                {
                  parent : model.getId(),
                  name   : newItem.getName()
                },
                true
              ])
              .catch(
                (e) =>
                {
                  console.warn("Error saving grocery category:", e);
                  qxl.dialog.Dialog.error(
                    `Error saving grocery category: ${e}`);
                })
              .then(
                (id) =>
                {
                  newItem.setId(id);
                  return newItem;
                });
          })

        // Wait for the new item to be ready, then...
        .then(
          (newItem) =>
          {
            // If they dropped onto a branch (always true)...
            if (model.getChildren)
            {
              // ... then add the new item to that branch, ...
              model.getChildren().push(newItem);

              // ... and resort so leaves are sorted in their branch
              model.getChildren().sort(
                (a, b) =>
                {
                  let             aName = a.getName();
                  let             bName = b.getName();

                  return aName < bName ? -1 : aName > bName ? 1 : 0;
                });
            }

            tree.buildLookupTable();
//            this._showModel();
          });
      });

    //
    // Context menu handling
    //

    // Create the context menu, initially disabled
    menu = new qx.ui.menu.Menu();

    tree.addListener(
      "pointerdown",
      (e) =>
      {
        let             menuButton;
        const { target, label, model, id } = this.__contextEventInfo(e);

        // If we found a removable category (and not "Categories" -> id=0)
        if (target && label && model && id)
        {
          // ... then (re)create the context menu
          menu.removeAll();
          tree.setContextMenu(menu);

          //
          // First, create the Rename button
          //
          menuButton = new qx.ui.menu.Button(`Rename '${label}'`);
          menu.add(menuButton);

          menuButton.addListener(
            "execute",
            () =>
            {
              qxl.dialog.Dialog.prompt(
                `Rename '${label}' to:`,
                (newName) =>
                {
                  if (! newName)
                  {
                    return;
                  }

                  qx.core.Init.getApplication().rpc(
                    "renameGroceryCategory",
                    [
                      {
                        id      : id,
                        newName : newName
                      }
                    ])
                    .catch(
                      (e) =>
                      {
                        console.warn(
                          `Error renaming grocery category ${label}:`, e);
                        qxl.dialog.Dialog.error(
                          `Error renaming grocery category ${label}: ${e}`);
                      })
                    .then(
                      () =>
                      {
                        let             item;
                        let             parent;
                        let             lookupTable;

                        model.setName(newName);

                        // Get the tree's lookup table which is an
                        // easily searchable array
                        lookupTable = tree.getLookupTable();

                        // Find the parent id
                        parent = model.getParent();

                        // Filter out all but the item with the
                        // designated value (id)
                        item = lookupTable.filter(
                          (item) => item.getId() === parent).getItem(0);

                        // Resort our parent's children
                        item.getChildren().sort(
                          (a, b) =>
                          {
                            let             aName = a.getName();
                            let             bName = b.getName();

                            return aName < bName ? -1 : aName > bName ? 1 : 0;
                          });
                      });
                });
            });

          //
          // Now create the Delete button
          //
          menuButton = new qx.ui.menu.Button(`Delete '${label}'`);
          menu.add(menuButton);

          menuButton.addListener(
            "execute",
            () =>
            {
              qxl.dialog.Dialog.confirm(
                `Are you sure you want to delete category '${label}?`,
               (result) =>
               {
                 // If they didn't confirm, we have nothing to do
                 if (! result)
                 {
                   return;
                 }

                qx.core.Init.getApplication().rpc(
                  "deleteGroceryCategory",
                  [
                    {
                      id : id
                    },
                    true
                  ])
                  .catch(
                    (e) =>
                    {
                      console.warn(
                        `Error deleting grocery category ${label}:`, e);
                      qxl.dialog.Dialog.error(
                        `Error deleting grocery category ${label}: ${e}`);
                    })
                  .then(
                    () =>
                    {
                      this.removeItem(tree.getModel(), model);
                      console.log(`Deleted grocery category ${label}`);
                    });
               });
            });
        }
        else
        {
          tree.setContextMenu(null);
        }
      });

    // Add label for, and then the actual image that can be dragged to
    // add a new category
    this.add(new qx.ui.core.Spacer(10, 10)); // just a bit of space after tree
    this.add(new qx.ui.basic.Label(
      "Drag this folder onto an existing category, " +
        "to create new sub-category"));
    dragDropImage = new qx.ui.basic.Image("icon/32/places/folder.png");
    dragDropImage.setDraggable(true);
    dragDropImage.addListener(
      "dragstart",
      (e) =>
      {
        e.addType("item");
        e.addAction("copy");
      });
    this.add(dragDropImage);
  },

  members :
  {
    /**
     * Provides access to the internal tree widget, for resizing, etc.
     *
     * @return {qx.ui.tree.VirtualTree}
     *   The internal tree widget
     */
    getTree()
    {
      return this._tree;
    },

    /**
     * Get the complete model data, as a native object
     *
     * @return {Map}
     *   The data model of the tree
     */
    getModelAsNativeObject()
    {
      return qx.util.Serializer.toNativeObject(this._tree.getModel());
    },

    /**
     * Remove an item by recursively searching into the tree for that item.
     *
     * @return {Boolean}
     *   Returns `true` if it found/removed the item; `false` otherwise.
     */
    removeItem(root, item)
    {
      let             children;

      // If the root doesn't have a children object or the item we're
      // removing is the root...
      if (! root.getChildren || item == root)
      {
        // ... then do nothing.
        return false;
      }

      // Recursively iterate children to find and remove the specified item
      children = root.getChildren();
      for (let i = 0; i < children.length; i++)
      {
        // Did we find the item to be removed?
        if (children.getItem(i) == item)
        {
          // Yup. Remove it.
          children.remove(item);

          // Let our caller know we found/removed it
          return true;
        }

        // Did the recursive call find/remove the item?
        if (this.removeItem(children.getItem(i), item))
        {
          // Yup, no need for any further action.
          return true;
        }
      }

      // Not found/removed
      return false;
    },

    _showModel()
    {
      console.log(JSON.stringify(this.getModelAsNativeObject(), null, "  "));
    },

    /**
     * Retrieve context menu event data
     *
     * @param e {MouseEvent}
     */
    __contextEventInfo(e)
    {
      let             target = null;
      let             label = null;
      let             model = null;
      let             id = null;

      if (e.getTarget())
      {
        target = e.getTarget();

        if (target.getLabel)
        {
          label = target.getLabel();
        }

        if (target.getModel)
        {
          model = target.getModel();

          if (model.getId)
          {
            id = model.getId();
          }
        }
      }

      return { target, label, model, id };
    }
  }
});
