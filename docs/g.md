# G Library (Micro Game Engine)

The `G` library provides a minimal 2D game engine foundation for YoBASIC. It is designed for teaching game development basics without requiring complex polling loops.

## Core API

### `G.Window w%, h%, title$`
Creates a game surface (canvas) of the specified width and height. If running in the desktop environment, it opens a new window.

### `G.Assets.LoadTexture key$, path$`
Asynchronously loads an image from the specified path and associates it with a key. The path can be a local VFS path or a URL.

### `G.Input.KeyDown(key$) -> ok%`
Returns `1` if the specified key is currently pressed, `0` otherwise.
Supported keys include: `"UP"`, `"DOWN"`, `"LEFT"`, `"RIGHT"`, `"SPACE"`, and standard alphanumeric keys.

### `G.Draw.Clear [color$]`
Clears the canvas. If a color is provided (e.g., `"#FF0000"` or `"red"`), it fills the canvas with that color.

### `G.Draw.Sprite key$, x#, y#`
Draws the sprite associated with the given key at the specified coordinates.

### `G.Run initSub, updateSub, drawSub`
Starts the game loop.
- `initSub`: A subroutine called once when the game starts.
- `updateSub(dt#)`: A subroutine called every frame for logic. `dt#` is the time elapsed since the last frame in seconds.
- `drawSub`: A subroutine called every frame for rendering.

### `G.Quit`
Stops the game loop and cleans up resources.

## Example

```basic
G.WINDOW 640, 480, "My Game"
G.ASSETS.LOADTEXTURE "PLAYER", "assets/player.png"

px# = 320 : py# = 240
speed# = 200

G.RUN "Init", "Update", "Draw"

SUB Init
  PRINTLN "Game Started!"
END SUB

SUB Update(dt#)
  IF G.INPUT.KEYDOWN("LEFT") THEN px# = px# - speed# * dt#
  IF G.INPUT.KEYDOWN("RIGHT") THEN px# = px# + speed# * dt#
  IF G.INPUT.KEYDOWN("UP") THEN py# = py# - speed# * dt#
  IF G.INPUT.KEYDOWN("DOWN") THEN py# = py# + speed# * dt#
END SUB

SUB Draw
  G.DRAW.CLEAR "#003366"
  G.DRAW.SPRITE "PLAYER", px#, py#
END SUB
```
