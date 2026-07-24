# Architecture

The application uses small classic JavaScript modules loaded in dependency order. Shared state is defined in `js/core/state.js`. Each business area has a separate file so changes stay isolated.

Report flow: Pivot -> Main -> Signature / Final.

Core Pending flow: Plan Upload -> Pending STO -> Raipur/manual/block checks -> Planning Database.
