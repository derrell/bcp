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
qx.Class.define("bcp.client.grocery.ItemSelectionTree",
{
  extend : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct(model)
  {
    let             tree;

    this.base(arguments, new qx.ui.layout.VBox());

    this.configureTriState(model);
    this.initValue(model);

    this._tree = tree =
      new qx.ui.tree.VirtualTree(model, "label", "children", "open");
    tree.set(
      {
        width                      : 400,
        hideRoot                   : true,
        showTopLevelOpenCloseIcons : true
      });
    tree.setDelegate(this);

    // Don't allow any selection
    tree._provider.isSelectable = () => false;

    // As model changes, track in in our value
    tree.getModel().addListener(
      "changeBubble",
      (e) =>
      {
        let             model = tree.getModel();

        this.setValue(model);
      });

    this.add(tree, { flex : 1 });
  },

  properties :
  {
    value :
    {
      check     : "Object",
      event     : "changeValue",
      nullable  : true
    }
  },

  members :
  {
    _tree : null,

    /**
     * If all children of all children are checked, containing branch is
     * checked. Similarly for all unchecked. Otherwise (not all), show branch
     * as a third state that indicates such.
     */
    configureTriState(item)
    {
      let             i;
      let             child;
      let             children;

      if (item.getChildren)
      {
        children = item.getChildren();
        for (i = 0; i < children.getLength(); i++)
        {
          child = children.getItem(i);
          this.configureTriState(child);

          // bind parent with child
          item.bind(
            "checked",
            child,
            "checked",
            {
              converter(value, child, source, target)
              {
                // when parent is set to null than the child should keep
                // it's value
                if (value === null)
                {
                  return target.getChecked();
                }
                return value;
              }
            });

          // bind child with parent
          child.bind(
            "checked",
            item,
            "checked",
            {
              converter(value, parent, source, target)
              {
                let             children;
                let             isAllChecked;
                let             isOneChecked;

                children = target.getChildren().toArray();

                isAllChecked = children.every(item => item.getChecked());
                isOneChecked = children.some(
                  item => item.getChecked() || item.getChecked() === null);

                // Set triState (on parent node) when one child is checked
                return isOneChecked ? (isAllChecked ? true : null) : false;
              }
            });
        }
      }
    },


    // delegate implementation
    createItem()
    {
      return new bcp.client.grocery.Item();
    },

    // delegate implementation
    bindItem(controller, item, id)
    {
      controller.bindDefaultProperties(item, id);
      controller.bindProperty("checked", "checked", null, item, id);
      controller.bindPropertyReverse("checked", "checked", null, item, id);
      controller.bindProperty("notes", "notes", null, item, id);
      controller.bindPropertyReverse("notes", "notes", null, item, id);
      controller.bindProperty(
        "notesVisibility", "notesVisibility", null, item, id);
    }
  }
});
