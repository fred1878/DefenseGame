/**
 * Town meta overlays (spell bar sort, endless, wave planner) are modal:
 * building taps and other town UI should not compete with an open overlay.
 */
export function townMetaOverlayBlocksBuildingInput(state: {
  spellSortPanel: unknown | null;
  endlessPanel: unknown | null;
  wavePlannerPanel: unknown | null;
}): boolean {
  return (
    state.spellSortPanel !== null ||
    state.endlessPanel !== null ||
    state.wavePlannerPanel !== null
  );
}