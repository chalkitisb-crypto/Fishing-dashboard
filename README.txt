v172 ROOT CAUSE FIX (from your 20s video)

WHAT WENT WRONG (v170):
  Sphere model was rotated every frame.
  Normals rotated with it → day side turned away from camera
  → at 78% the disc went almost BLACK. That is the bug.

FIX (v172):
  1. Geometry NEVER rotates
  2. Light direction FIXED from phase % only
  3. Spin = UV offset only (texture crawls, terminator stays)
  4. Ambient 0.28 so night side still shows surface
  5. Crescent set mirrored
  6. Layout tightened

VERIFY on device:
  - At 78% stays ~78% lit the whole 30s cycle
  - Surface features slowly move
  - Never goes full black
