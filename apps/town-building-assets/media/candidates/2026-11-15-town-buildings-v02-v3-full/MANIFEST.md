# DefenseGame town buildings v3 — full v02 batch

Batch: **town-buildings-v3-full-v02-2026-11-15** · **30 PNGs** (15 keys × **v02 only** × day/night). Peter approved pilot **v02** + v3 endpoint mix.

Does **not** overwrite pilot, v1, or v2-distinct bundles.

## Endpoint routing

| texture_key | endpoint_mode | source |
| --- | --- | --- |
| `town_wall` | `map-objects` | pilot v3 |
| `town_blacksmith` | `generate-ui-v2` | pilot v3 |
| `town_barracks` | `map-objects` | pilot v3 |
| `town_market_stall` | `create-image-pixen` | pilot v3 |
| `town_chapel` | `map-objects` | pilot v3 |
| `town_special_raven_roost` | `map-objects` | full-batch default |
| `town_special_plague_clinic` | `map-objects` | full-batch default |
| `town_special_haunted_well` | `create-image-pixen` | pilot v3 |
| `town_special_siege_yard` | `map-objects` | full-batch default |
| `town_special_bone_archive` | `map-objects` | full-batch default |
| `town_special_witchlight_beacon` | `create-image-pixen` | full-batch default |
| `town_special_gallows_square` | `create-image-pixen` | pilot v3 |
| `town_special_ossuary_gate` | `map-objects` | full-batch default |
| `town_special_moon_brazier` | `create-image-pixen` | full-batch default |
| `town_special_rat_catcher_hut` | `map-objects` | full-batch default |

## Contact sheets

- `contact-sheet-common-day-2026-11-15-v02-v3-full.png`
- `contact-sheet-common-night-2026-11-15-v02-v3-full.png`
- `contact-sheet-special-day-2026-11-15-v02-v3-full.png`
- `contact-sheet-special-night-2026-11-15-v02-v3-full.png`

## Generation log

| File | Key | Light | Endpoint | Size | Seed | id | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/day/town-wall-v02-day-128x56.png` | `town_wall` | day | POST /v2/map-objects | 128×56 | 113510 | 56637635-0a9f-4eef-a7ff-8098b58b39c5 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/night/town-wall-v02-night-128x56.png` | `town_wall` | night | POST /v2/map-objects | 128×56 | 123510 | c7aa5136-aaf4-47b2-b418-d7df47b280bc | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/day/town-blacksmith-v02-day-96x96.png` | `town_blacksmith` | day | POST /v2/generate-ui-v2 | 96×96 | 113502 | 4ccb4201-d3d7-406b-828d-f84a36302672 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/night/town-blacksmith-v02-night-96x96.png` | `town_blacksmith` | night | POST /v2/generate-ui-v2 | 96×96 | 123502 | b498262c-4459-4c1f-8e36-d6984f01409a | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/day/town-barracks-v02-day-112x96.png` | `town_barracks` | day | POST /v2/map-objects | 112×96 | 113508 | ac7181bc-16f7-4d57-a2f5-bc7f35341834 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/night/town-barracks-v02-night-112x96.png` | `town_barracks` | night | POST /v2/map-objects | 112×96 | 123508 | 17754624-cfa5-4ba1-8c10-ccc38f7f50a2 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/day/town-market-stall-v02-day-112x72.png` | `town_market_stall` | day | POST /v2/create-image-pixen | 112×72 | 113504 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/night/town-market-stall-v02-night-112x72.png` | `town_market_stall` | night | POST /v2/create-image-pixen | 112×72 | 123504 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/day/town-chapel-v02-day-96x112.png` | `town_chapel` | day | POST /v2/map-objects | 96×112 | 113506 | eeb7d097-ebce-403c-817e-bd8a271e0f51 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/common/night/town-chapel-v02-night-96x112.png` | `town_chapel` | night | POST /v2/map-objects | 96×112 | 123506 | a8ab385d-8c34-4cd5-b68f-8128f1156871 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-raven-roost-v02-day-96x112.png` | `town_special_raven_roost` | day | POST /v2/map-objects | 96×112 | 112517 | 3039fe27-8b9d-432d-b88a-d3224ae75213 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-raven-roost-v02-night-96x112.png` | `town_special_raven_roost` | night | POST /v2/map-objects | 96×112 | 122517 | 685e06d4-c654-4348-91ad-e8c3761cb943 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-plague-clinic-v02-day-96x96.png` | `town_special_plague_clinic` | day | POST /v2/map-objects | 96×96 | 112520 | 6ca232ba-17c3-4f19-b68c-8232e34394ac | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-plague-clinic-v02-night-96x96.png` | `town_special_plague_clinic` | night | POST /v2/map-objects | 96×96 | 122520 | 7b05a41e-7044-448b-b80b-a54106a422c2 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-haunted-well-v02-day-80x80.png` | `town_special_haunted_well` | day | POST /v2/create-image-pixen | 80×80 | 113514 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-haunted-well-v02-night-80x80.png` | `town_special_haunted_well` | night | POST /v2/create-image-pixen | 80×80 | 123514 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-siege-yard-v02-day-112x96.png` | `town_special_siege_yard` | day | POST /v2/map-objects | 112×96 | 112526 | 3dd37ef1-cfbb-4eea-a5d5-a3e00a885157 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-siege-yard-v02-night-112x96.png` | `town_special_siege_yard` | night | POST /v2/map-objects | 112×96 | 122526 | 843b90ef-56c9-4fb9-abeb-33551a43f665 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-bone-archive-v02-day-96x112.png` | `town_special_bone_archive` | day | POST /v2/map-objects | 96×112 | 112529 | 53d83ba2-126c-489d-bd32-aa6910e09ab9 | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-bone-archive-v02-night-96x112.png` | `town_special_bone_archive` | night | POST /v2/map-objects | 96×112 | 122529 | 76d8a84c-61c3-4fdb-9615-5565ca0db82a | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-witchlight-beacon-v02-day-80x112.png` | `town_special_witchlight_beacon` | day | POST /v2/create-image-pixen | 80×112 | 112532 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-witchlight-beacon-v02-night-80x112.png` | `town_special_witchlight_beacon` | night | POST /v2/create-image-pixen | 80×112 | 122532 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-gallows-square-v02-day-112x72.png` | `town_special_gallows_square` | day | POST /v2/create-image-pixen | 112×72 | 113512 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-gallows-square-v02-night-112x72.png` | `town_special_gallows_square` | night | POST /v2/create-image-pixen | 112×72 | 123512 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-ossuary-gate-v02-day-96x96.png` | `town_special_ossuary_gate` | day | POST /v2/map-objects | 96×96 | 112538 | 56c8f434-5ff6-47a2-8454-7ff48757e33c | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-ossuary-gate-v02-night-96x96.png` | `town_special_ossuary_gate` | night | POST /v2/map-objects | 96×96 | 122538 | a827e45a-a5a5-4202-9582-2b3680562b6e | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-moon-brazier-v02-day-80x80.png` | `town_special_moon_brazier` | day | POST /v2/create-image-pixen | 80×80 | 112541 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-moon-brazier-v02-night-80x80.png` | `town_special_moon_brazier` | night | POST /v2/create-image-pixen | 80×80 | 122541 | — | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/day/town-special-rat-catcher-hut-v02-day-96x96.png` | `town_special_rat_catcher_hut` | day | POST /v2/map-objects | 96×96 | 112545 | eb8cca7b-2e7f-478e-910a-f578ee20e5fd | ok |
| `outputs/town-buildings-v3-full-v02-2026-11-15/special/night/town-special-rat-catcher-hut-v02-night-96x96.png` | `town_special_rat_catcher_hut` | night | POST /v2/map-objects | 96×96 | 122545 | 2b187053-d113-492a-b011-dff288307534 | ok |

## Regenerate

```bash
npm run generate:town-buildings-v3-full-v02
python3 scripts/build-town-buildings-review.py --batch town-buildings-v3-full-v02-2026-11-15 --store 2026-11-15-town-buildings-v02-v3-full --layout v2-daynight --suffix 2026-11-15-v02-v3-full --title-note 'v02 only v3 endpoints'
```

Store: `/cursor/stores/bc-231c7aa6-7e8f-4ab4-8431-454b2117da2f/media/candidates/2026-11-15-town-buildings-v02-v3-full`.

- **Generated**: 30/30 ok
- **Estimated API usage**: ~$0.0000
