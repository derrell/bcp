qx.Class.define("bcp.client.RegisterFormElements",
{
  statics :
  {
    _registrations :
    {
      appointments :
      {
        initElement : function(fieldType, fieldData, key)
        {
          let formElement = new bcp.client.Appointment(true);
          return formElement;
        },

        addToFormController : function(fieldType, fieldData, key, formElement)
        {
          this._formController.addTarget(
            formElement, "value", key, true, null);
        }
      },

      calendar :
      {
        initElement : function(fieldType, fieldData, key)
        {
          let formElement = new qx.ui.control.DateChooser();
          return formElement;
        },

        addToFormController : function(fieldType, fieldData, key, formElement)
        {
          this._formController.addTarget(
            formElement, "value", key, true, null);
        }
      }
    },

    register : function()
    {
      let             formElementType;
      let             clazz = bcp.client.RegisterFormElements;

      for (formElementType in clazz._registrations)
      {
        qxl.dialog.Dialog.registerFormElementHandlers(
          formElementType, clazz._registrations[formElementType]);
      }
    }
  }
});
