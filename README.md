# NFC Player

A standalone NFC-triggered player for a public exhibition audio collection.

Open the GitHub Pages site in Android Chrome and enable NFC. The first setup downloads 18 existing public recordings. Wait for the enable button to disappear and the spin prompt to return before disconnecting. Reopen the same site in the same regular Chrome profile and enable NFC again. Clearing site data removes the offline pack. Previously downloaded copies cannot be remotely recalled while offline.

Write one NDEF Text record to each compatible tag: `fukuoka-voice-player:v1`, `fukuoka-voice-player:v1:02`, `fukuoka-voice-player:v1:03`, `fukuoka-voice-player:v1:04`. All four select from the same local pool. A tap plays one random recording; another tap interrupts it and selects a different recording when possible. Playback stops at the end. The page requests a screen wake lock when enabled and again when it returns to the foreground.

The map uses [OpenStreetMap](https://www.openstreetmap.org/copyright) data for the PayPay Dome neighborhood, with the dome roof stylized as a turntable. The site does not store recording files or need operator credentials.

To regenerate the map, download the [OSM map JSON](https://api.openstreetmap.org/api/0.6/map.json?bbox=130.356,33.591,130.368,33.600) and run `node scripts/render-dome-map.mjs <downloaded-json>`. OpenStreetMap data is available under the ODbL.

Run `node --test` to check the player logic. GitHub Pages serves the `gh-pages` branch, generated with `git subtree split --prefix dist`.

When publishing website changes, bump the asset version together in `dist/index.html`, `dist/main.mjs`, and `dist/sw.js`. For immediate phone testing, share the page URL with the new version as its query string as well.
