# NFC Player

A standalone NFC-triggered player for a public exhibition audio collection.

Open the GitHub Pages site in Android Chrome and enable NFC. Write the NDEF text `fukuoka-voice-player:v1` to a compatible NFC tag. A tap plays one random recording; another tap interrupts it and selects a different recording when possible. Playback stops at the end.

The white city model is illustrative, not a geographic map. The site does not store recording files or need operator credentials.

Run `node --test` to check the player logic. GitHub Pages serves the `gh-pages` branch, generated with `git subtree split --prefix dist`.
