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
qx.Class.define("bcp.client.grocery.CategorySelectionTree",
{
  extend : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct(model)
  {
    let             tree;

    this.base(arguments, new qx.ui.layout.VBox());

    tree = this._tree =
      new qx.ui.tree.VirtualTree(model, "label", "children", "open");
    tree.set(
      {
        width                      : 400,
        hideRoot                   : true,
        showTopLevelOpenCloseIcons : true,
        selectionMode              : "single"
      });

    tree.getSelection().addListener(
      "change",
      (e) =>
      {
        if (! this.__internalChange)
        {
          this.setValue(e.getData().added[0].getId());
console.log("change: new value is " + this.getValue());
        }
      });

    this.add(tree);
  },

  properties :
  {
    value :
    {
      check     : "Number",
      event     : "changeValue",
      nullable  : false,
      apply     : "_applyValue"
    }
  },

  members :
  {
    _tree            : null,
    __internalChange : false,

    _forwardStates :
    {
      focused : true,
      invalid : true
    },

    // property apply
    _applyValue(value, old)
    {
      let             item;
      let             lookupTable;

      // Get the tree's lookup table which is an easily searchable array
      lookupTable = this._tree.getLookupTable();

      // Filter out all but the item with the designated value (id)
      item = lookupTable.filter((item) => item.getId() === value).getItem(0);

      // That item gets selected. Protect from infinite recursion
      this.__internalChange = true;
      this._tree.setSelection( [ item ] );
      this.__internalChange = false;
    }
  }
});
