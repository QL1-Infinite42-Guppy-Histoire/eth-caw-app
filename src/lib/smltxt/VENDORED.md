Vendored copy of the `smltxt` package sources from the Gilgamesh CAW
repository (`Caw/smltxt/src`, v0.1.0), copied on 2026-11-10.

Why vendored: post text in CAW actions is smltxt-compressed bytes — the node
decompresses with this exact table, and there is no plain-text fallback.
The package is not published to npm (the node consumes it as a local
`file:` dependency), so the app carries the same sources to stay
byte-compatible with the node.

Do not edit these files; update them wholesale if the upstream table changes.
