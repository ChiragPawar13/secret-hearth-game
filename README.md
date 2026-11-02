# Mystery Mansion Manor

Create a complete 3D multiplayer murder mystery social deduction game for PC and Mobile.

Game Title: PARA

Core Concept:

- 4 to 12 players per match.

- One player is randomly selected as the Murderer.

- Remaining players are Detectives/Witnesses.

- The Murderer must secretly eliminate all other players.

- Detectives must gather clues, identify the Murderer, and vote them out.

Gameplay:

- Third-person 3D character controller.

- Walking, running, crouching, jumping.

- Real-time multiplayer matchmaking and private rooms.

- Voice chat and text chat.

- Random role assignment at match start.

- Role remains hidden from other players.

Murderer Features:

- Kill ability with cooldown.

- Ability to sabotage lights and security systems.

- Can create distractions.

- Wins by eliminating all Detectives.

Detective Features:

- Complete tasks around the map.

- Collect clues from crime scenes.

- Report dead bodies.

- Call emergency meetings.

- Vote to eliminate suspected players.

Meeting System:

- Discussion timer.

- Voting timer.

- Skip vote option.

- Display voting results.

- Eliminate player with highest votes.

Maps:

- Start with one detailed mansion map.

- Multiple rooms, hallways, secret passages, basement, garden, security room, and hiding spots.

- Spawn points distributed across the map.

Tasks:

- Repair electrical panels.

- Restore CCTV systems.

- Search documents.

- Unlock evidence lockers.

- Collect fingerprints and clues.

UI:

- Main menu.

- Create room.

- Join room.

- Matchmaking screen.

- Role reveal screen.

- Task panel.

- Evidence panel.

- Meeting/voting screen.

- Win/Lose screen.

- Settings menu.

Characters:

- Use capsule placeholders during prototype phase.

- Separate character models that can later replace capsules.

- Support character customization and skins.

Animations:

- Idle.

- Walk.

- Run.

- Crouch.

- Jump.

- Kill.

- Report body.

- Emotes.

Audio:

- Suspense background music.

- Footsteps.

- Kill effects.

- Meeting sounds.

- Ambient mansion sounds.

Technical Requirements:

- Unity 6.

- Netcode for GameObjects or Photon Fusion multiplayer.

- Modular code architecture.

- Optimized for PC and Android.

- Scalable system for future maps and game modes.

Win Conditions:

- Murderer wins when all Detectives are eliminated.

- Detectives win when Murderer is voted out or all tasks are completed.

Future Expansion Support:

- Additional maps.

- Multiple murderers mode.

- Ranked matchmaking.

- Cosmetic store.

- Battle pass.

- Seasonal events.

Generate complete project structure, scene hierarchy, scripts, prefabs, networking architecture, UI flow, and development roadmap.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b34e4177-a99c-4439-b0fc-66bf7628b59e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
