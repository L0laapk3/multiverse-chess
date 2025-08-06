# Multiverse Chess

[![Discord](https://img.shields.io/discord/763763925140635659?label=Discord&logo=discord&logoColor=white)](https://discord.gg/UgVKykY)



## Description

This is the source code behind [multiversechess.com](https://multiversechess.com/).

- This project is hosted for free on [Fly.io](https://fly.io/).
- [Node.js](https://nodejs.org/en/docs) is used for the backend since the game logic is ran by both the client and the server. The client visualisation and animations are layered ontop of the game logic classes.

> Note: If I were to start over, I would select WebGL (or js+canvas) for rendering. However, I wanted to see how far DOM could be pushed.

## Structure

- **public/js/game.js** and **public/js/gamePieces.js**
  - Core logic of the game. It validates all the moves and keeps track of the game state. 
  - Used by both the client and the server.


- **public/js/client.js** and **public/js/clientPieces.js**
  - These files layer the animations by hooking into inherited methods from the core game logic above.
  - Used in the client.


- **public/js/main.js** and **public/js/menu.js**
  - The main files for the client, they control the user workflow and the main menu.

- **index.js**, **socket.js** and **discordBridge.js**
  - The main files for the server, they manage all the games and notify the discord bridge when new games are created.

## Running Locally

To run the project locally for development:
```bash
pnpm install
pnpm start
```

## Contributions

Contributions are welcome, feel free to open an issue or a pull request, and join our [discord server](https://discord.gg/UgVKykY)!

### Credit

- Thanks a ton to [penteract](https://github.com/penteract) for his [hypercuboid checkmate search algorithm](https://github.com/penteract/hcuboid-ts).