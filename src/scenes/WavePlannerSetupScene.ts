import type { DataStore, WaveGroup } from "../core/data/DataStore";
import {
  ensureTownReachableReady,
  isTownReachableReady,
} from "./loading/GameAssetLoader";
import { WavePlannerPanel } from "../ui/panels/WavePlannerPanel";
import {
  closeTownSetupScene,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
  type WavePlannerSetupLaunchData,
} from "./town/townSetupSceneLifecycle";
import { TownRosterSetupScene } from "./town/TownRosterSetupScene";
import { reportFatal } from "../ui/panels/FatalErrorPanel";

export class WavePlannerSetupScene extends TownRosterSetupScene<
  WavePlannerPanel,
  WavePlannerSetupLaunchData
> {
  constructor() {
    super({ key: TOWN_WAVE_PLANNER_SETUP_SCENE_KEY });
  }

  protected openSetup(store: DataStore): void {
    const open = (): void =>
      this.showPanel(
        () =>
          new WavePlannerPanel(
            this,
            store,
            (groups: WaveGroup[]) => {
              const launch = this.launchData;
              this.startRun(() => launch.onStart(groups));
            },
            () => this.dismissPanel(),
          ),
      );

    if (isTownReachableReady(this.game, store)) {
      open();
    } else {
      void ensureTownReachableReady(this, store)
        .then(open)
        .catch((err) => {
          reportFatal(this, {
            title: "Could not load the wave planner",
            message: "Check your connection and try again.",
            error: err,
            onRetry: () => this.openSetup(store),
            onClose: () => closeTownSetupScene(this),
          });
        });
    }
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    if (!this.panel) return {};
    return this.panel.e2eTapTargets();
  }

  e2eIsOpen(): boolean {
    return this.panel !== null;
  }
}
