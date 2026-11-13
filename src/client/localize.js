// Translate through the slot-provided t, with the English dictionary as the last resort.
    /** Slot-provided translator; the English dictionary stands in before the locale service answers. */
    function localize(props) {
      return props.t ?? (key => STRINGS.en[key] ?? key)
    }
