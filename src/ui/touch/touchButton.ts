/** Stable import path for touch UI — implementations live in sibling modules. */
export type { TouchButtonHandle } from "./touchButtonFactories";

export {
  createTouchButton,
  createTouchToggleButton,
  createTouchCircleButton,
} from "./touchButtonFactories";

export { bindContainerPress, bindTapOrLongPress } from "./touchButtonPress";

export {
  hitAreaLocalPointToScreen,
  interactiveObjectScreenRect,
  containerScreenRect,
  isTouchButtonVisuallyPressed,
  pointerInScreenRect,
} from "./touchButtonGeometry";
