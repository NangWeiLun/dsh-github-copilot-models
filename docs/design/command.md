# Login from a chat command

Status: not started. Details are to be filled in later.

## Goal

Let the user sign in, sign out and check the Copilot login from the chat box in the DSH Web UI and from the `dsh` terminal UI, not only from the settings card.

## Commands (draft)

| Command | Does |
|---|---|
| `/copilot-status` | Shows signed in or not, method, account name, Copilot host |
| `/logout-copilot` | Signs out (same steps as the card) |
| `/login-copilot` | Starts a browser login and shows the code and link |
| `/login-copilot pat <token>` | Signs in with a PAT (draft; see the input-history risk below) |

## Known constraints

- DSH slash commands are registered with `ctx.commands.register`. They work in the `dsh` terminal UI and the Web client, not in ACP automation.
- A command returns one result (`success` or `error`, plus text). It cannot show a live device code and then wait. A browser login needs two steps, for example `/login-copilot` to start and `/copilot-status` to see the result.
- A command cannot ask the user a question; `dsh-user-questions` works from tool calls only.
- `/login-copilot pat <token>` must set `recordInput: false`, so the token is not written to the session log. Even then, a token typed into the chat box can stay in the input history or the terminal's scrollback, so the Card stays the recommended place to enter a PAT.
- Reuse the login code in `src/host/login.ts` (design: [login.md](login.md)). No second implementation.

## To decide later

- Which commands ship in which version.
- Whether the PAT variant ships at all, given the input-history risk above.
- Command names.
- How a browser login started from a command reports that it finished.
